const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

module.exports = function (eleventyConfig) {
  // Static assets copied straight through to _site/.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/fonts");
  // Only the web-res webp ships. src/images/portrait.jpg is the committed
  // master (there is no higher-res original of it anywhere) and stays out of
  // _site, the same way the photos/ library does.
  eleventyConfig.addPassthroughCopy("src/images/*.webp");
  eleventyConfig.addPassthroughCopy("src/images/*.avif");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");

  // Cache-bust the stylesheet and scripts with a hash of their own contents.
  // GitHub Pages serves everything under one short, unconfigurable
  // Cache-Control (there is no _headers file to reach for), so without this a
  // returning visitor can sit on a stale style.css against fresh HTML. The
  // query string changes only when the file does, so the CDN and the browser
  // can both hold onto it for as long as they like in between.
  const hashes = new Map();
  eleventyConfig.addFilter("bust", (url) => {
    if (!hashes.has(url)) {
      let tag = "";
      try {
        const buf = fs.readFileSync(path.join("src", url));
        tag = "?v=" + crypto.createHash("md5").update(buf).digest("hex").slice(0, 8);
      } catch (e) {
        // Missing file: ship the plain URL rather than failing the build.
      }
      hashes.set(url, url + tag);
    }
    return hashes.get(url);
  });

  // Roman numerals for the collection catalogue (I / V), matching the v5 design.
  eleventyConfig.addFilter("roman", (num) => {
    const map = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    let n = Number(num) || 0;
    let out = "";
    for (const [v, s] of map) {
      while (n >= v) { out += s; n -= v; }
    }
    return out;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
