<?php
/**
 * Exporta e importa los Global Styles de GenerateBlocks (CPT `gblocks_styles`).
 *
 *   wp eval-file global-styles.php exportar <fichero.json> --path="<sitio>"
 *   wp eval-file global-styles.php importar <fichero.json> [dry] --path="<sitio>"
 *
 * Anatomia verificada el 28/08/2026 contra GenerateBlocks Pro 2.7.0:
 *   post_title          el selector, p.ej. `.gbp-section`
 *   menu_order          el ORDEN DE SALIDA del CSS (= especificidad, de arriba abajo)
 *   gb_style_selector   el selector
 *   gb_style_css        el CSS compilado de ese selector
 *   gb_style_data       el objeto de estilos en camelCase, misma forma que `styles` de un bloque
 *
 * Se compila a la opcion `generateblocks_style_css` y al fichero
 * `uploads/generateblocks/style-global.css`.
 */

$modo    = isset( $args[0] ) ? $args[0] : '';
$fichero = isset( $args[1] ) ? $args[1] : '';
// wp-cli intercepta los flags con guiones, asi que el modo simulacion va posicional.
$dry     = ( isset( $args[2] ) && 'dry' === $args[2] );

if ( ! in_array( $modo, array( 'exportar', 'importar' ), true ) || ! $fichero ) {
	WP_CLI::error( 'Uso: wp eval-file global-styles.php exportar|importar <fichero.json> [dry]' );
}

$CPT   = 'gblocks_styles';
$METAS = array( 'gb_style_selector', 'gb_style_css', 'gb_style_data' );

if ( ! post_type_exists( $CPT ) ) {
	WP_CLI::error( "Este WordPress no tiene el tipo de contenido `$CPT`. ¿Está GenerateBlocks Pro activo?" );
}

// ---------------------------------------------------------------- exportar

if ( 'exportar' === $modo ) {
	$posts = get_posts( array(
		'post_type'   => $CPT,
		'numberposts' => -1,
		'post_status' => 'any',
		'orderby'     => array( 'menu_order' => 'ASC', 'ID' => 'ASC' ),
	) );

	$fuera = array();
	foreach ( $posts as $p ) {
		$entrada = array(
			'selector' => get_post_meta( $p->ID, 'gb_style_selector', true ) ?: $p->post_title,
			'titulo'   => $p->post_title,
			'orden'    => (int) $p->menu_order,
			'estado'   => $p->post_status,
			'css'      => get_post_meta( $p->ID, 'gb_style_css', true ),
		);
		// gb_style_data se guarda como JSON en una cadena: se decodifica para que el diff se lea.
		$data = get_post_meta( $p->ID, 'gb_style_data', true );
		if ( is_string( $data ) && $data !== '' ) {
			$dec = json_decode( $data, true );
			$entrada['data'] = ( json_last_error() === JSON_ERROR_NONE ) ? $dec : $data;
		} else {
			$entrada['data'] = $data;
		}
		$fuera[] = $entrada;
	}

	$doc = array(
		'generadoPor' => 'herramientas/global-styles.js',
		'fecha'       => gmdate( 'c' ),
		'sitio'       => get_option( 'siteurl' ),
		'gbVersion'   => get_option( 'generateblocks_pro_version', get_option( 'generateblocks_version', '?' ) ),
		'aviso'       => 'El ORDEN de este array es la especificidad: GenerateBlocks saca el CSS de arriba abajo. No lo reordenes sin querer.',
		'estilos'     => $fuera,
	);

	$json = json_encode( $doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	if ( false === file_put_contents( $fichero, $json . "\n" ) ) {
		WP_CLI::error( "No he podido escribir $fichero" );
	}

	printf( "exportados %d estilos globales -> %s\n", count( $fuera ), $fichero );
	foreach ( array_slice( $fuera, 0, 40 ) as $e ) {
		printf( "  %3d  %-34s %d bytes de css\n", $e['orden'], $e['selector'], strlen( (string) $e['css'] ) );
	}
	if ( count( $fuera ) > 40 ) {
		printf( "  ... y %d mas\n", count( $fuera ) - 40 );
	}
	return;
}

// ---------------------------------------------------------------- importar

if ( ! file_exists( $fichero ) ) {
	WP_CLI::error( "No existe $fichero" );
}
$doc = json_decode( file_get_contents( $fichero ), true );
if ( ! is_array( $doc ) || ! isset( $doc['estilos'] ) || ! is_array( $doc['estilos'] ) ) {
	WP_CLI::error( 'El JSON no tiene la forma esperada (falta `estilos`).' );
}

printf( "%s %d estilos desde %s\n", $dry ? 'SIMULANDO' : 'importando', count( $doc['estilos'] ), basename( $fichero ) );
printf( "  exportado el %s desde %s (GB %s)\n\n", $doc['fecha'] ?? '?', $doc['sitio'] ?? '?', $doc['gbVersion'] ?? '?' );

// Indice de lo que ya hay, por selector.
$existentes = array();
foreach ( get_posts( array( 'post_type' => $CPT, 'numberposts' => -1, 'post_status' => 'any' ) ) as $p ) {
	$sel = get_post_meta( $p->ID, 'gb_style_selector', true ) ?: $p->post_title;
	$existentes[ $sel ] = $p->ID;
}

$creados = 0; $actualizados = 0; $iguales = 0;

foreach ( $doc['estilos'] as $e ) {
	$sel = $e['selector'] ?? $e['titulo'] ?? '';
	if ( ! $sel ) { continue; }

	$data = $e['data'] ?? '';
	if ( is_array( $data ) ) {
		$data = json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	}

	$id = $existentes[ $sel ] ?? 0;

	if ( $id ) {
		$cssActual  = get_post_meta( $id, 'gb_style_css', true );
		$dataActual = get_post_meta( $id, 'gb_style_data', true );
		$ordenActual = (int) get_post( $id )->menu_order;

		// `gb_style_data` es un JSON en una cadena. Al exportar se decodifica para que el diff
		// se lea, y al importar se vuelve a codificar — asi que los bytes NO coinciden aunque el
		// contenido sea el mismo. Se compara la ESTRUCTURA, no la cadena: si no, cada importacion
		// reescribiria los 13 estilos sin motivo.
		$decodificar = function ( $v ) {
			if ( is_array( $v ) ) { return $v; }
			if ( is_string( $v ) && $v !== '' ) {
				$d = json_decode( $v, true );
				return ( json_last_error() === JSON_ERROR_NONE ) ? $d : $v;
			}
			return $v;
		};
		$igual = ( trim( (string) $cssActual ) === trim( (string) ( $e['css'] ?? '' ) ) )
			&& ( $decodificar( $dataActual ) == $decodificar( $e['data'] ?? '' ) )
			&& ( $ordenActual === (int) ( $e['orden'] ?? 0 ) );
		if ( $igual ) {
			printf( "  IGUAL      %-34s\n", $sel );
			$iguales++;
			continue;
		}
		printf( "  ACTUALIZA  %-34s (ID %d)\n", $sel, $id );
		if ( ! $dry ) {
			wp_update_post( array(
				'ID'         => $id,
				'post_title' => $e['titulo'] ?? $sel,
				'menu_order' => (int) ( $e['orden'] ?? 0 ),
			) );
			update_post_meta( $id, 'gb_style_selector', $sel );
			update_post_meta( $id, 'gb_style_css', $e['css'] ?? '' );
			update_post_meta( $id, 'gb_style_data', $data );
		}
		$actualizados++;
	} else {
		printf( "  CREA       %-34s\n", $sel );
		if ( ! $dry ) {
			$nuevo = wp_insert_post( array(
				'post_type'   => $CPT,
				'post_title'  => $e['titulo'] ?? $sel,
				'post_status' => $e['estado'] ?? 'publish',
				'menu_order'  => (int) ( $e['orden'] ?? 0 ),
			), true );
			if ( is_wp_error( $nuevo ) ) {
				printf( "     FALLO: %s\n", $nuevo->get_error_message() );
				continue;
			}
			update_post_meta( $nuevo, 'gb_style_selector', $sel );
			update_post_meta( $nuevo, 'gb_style_css', $e['css'] ?? '' );
			update_post_meta( $nuevo, 'gb_style_data', $data );
		}
		$creados++;
	}
}

printf( "\n  creados %d · actualizados %d · sin cambios %d\n", $creados, $actualizados, $iguales );

if ( ! $dry && ( $creados || $actualizados ) ) {
	// El CSS global se compila a una opcion y a un fichero: hay que invalidarlos.
	delete_option( 'generateblocks_style_css' );
	$f = WP_CONTENT_DIR . '/uploads/generateblocks/style-global.css';
	if ( file_exists( $f ) ) { @unlink( $f ); }
	update_option( 'generateblocks_dynamic_css_posts', array() );
	echo "  CSS global invalidado: se regenera en la primera visita al frontend.\n";
}

if ( $dry ) {
	echo "\n  (simulacion: no se ha escrito nada)\n";
}
