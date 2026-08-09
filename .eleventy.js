module.exports = function (eleventyConfig) {
  // Static assets copied straight through to _site/.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");

  // Current year, used in the footer copyright.
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

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
