const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const Image = require("@11ty/eleventy-img");

const imageShortcode = async (src, alt, sizes) => {
  const metadata = await Image(src, {
    // Max width is based on the layout container width * 2.
    widths: [400, 800, 1000, 1200, 1450],
    outputDir: './_site/img/',
  });

  const imageAttributes = {
    alt,
    sizes,
  };

  return Image.generateHTML(metadata, imageAttributes);
};

module.exports = function(eleventyConfig) {
  eleventyConfig.addCollection('posts', function (collectionApi) {
    return collectionApi
      .getFilteredByGlob('_posts/*.md')
      .filter(post => post.data.hidden !== true);
  });

  eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);

  eleventyConfig.addLayoutAlias('default', 'layouts/default.njk');
  eleventyConfig.addLayoutAlias('post', 'layouts/post.njk');

  eleventyConfig.addPlugin(syntaxHighlight);

  return {
    markdownTemplateEngine: 'njk',
  };
};
