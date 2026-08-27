// Reproduce WordPress core serialize_block_attributes() escaping, then parse back.
const BS = String.fromCharCode(92); // a single backslash

const attrs = {
  uniqueId: "hero001",
  styles: { "background-color": "var(--color-primary)" },
  css: ".gb-element-hero001{background-color:var(--color-primary)}"
};

const json = JSON.stringify(attrs);

// WP core strtr table, the '--' rule being the relevant one
const escaped = json
  .split("--").join(BS + "u002d" + BS + "u002d")
  .split("<").join(BS + "u003c")
  .split(">").join(BS + "u003e")
  .split("&").join(BS + "u0026");

const markup = "<!-- wp:generateblocks/element " + escaped + " -->";

console.log("1. escaped JSON actually contains u002d :", escaped.includes("u002d"));
console.log("2. raw '--' left inside attributes      :", escaped.includes("--"));
console.log("3. first '-->' occurs only at the end   :", markup.indexOf("-->") === markup.length - 3);
console.log("4. markup:");
console.log("   " + markup);

const back = JSON.parse(escaped);
console.log("5. parsed styles value ->", back.styles["background-color"]);
console.log("6. parsed css value    ->", back.css);
console.log("7. lossless round-trip ->", JSON.stringify(back) === json);
