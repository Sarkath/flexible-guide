/* build.js - by Sarkath <sarkathian@gmail.com>

   Pieces an HTML file together from a bunch of disparate components.
   There are many like it, but this one is mine. :)

   This Node script is distributed under the MIT license:

        Copyright (c) 2022 Sarkath <sarkathian@gmail.com>

        Permission is hereby granted, free of charge, to any person obtaining a copy of
        this software and associated documentation files (the "Software"), to deal in
        the Software without restriction, including without limitation the rights to
        use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
        the Software, and to permit persons to whom the Software is furnished to do so,
        subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
        COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
        IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
        CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

const path = require("path");

function run(inputFilename, outputFilename, options) {
    const beautify = require("beautify");
    const fs = require("fs");
    const html = require("node-html-parser");
    const markdown = require("markdown-it")();
    const minifyHtml = require("@minify-html/js");
    const path = require("path");
    const sass = require("sass");

    // Fetch the base path of the source file.
    const sourcePath = path.dirname(inputFilename);

    function readTextFile(filename) {
        const inputFileHandle = fs.openSync(filename, "r");
        const textData = fs.readFileSync(inputFileHandle).toString();
        fs.closeSync(inputFileHandle);

        return textData;
    }

    /**
     * A callback function that handles parsing and embedding the specified file
     * into the element.
     * @callback substituteFileCallback
     * @param element {HTMLElement} - The element to process.
     * @param filename {string} - The file that should be embedded in the element.
     * @returns {HTMLElement} - The result of the substitution.
     */

    /**
     * A callback function that handles parsing and embedding the specified file
     * into the element.
     * @callback substituteMetadataCallback
     * @param element {HTMLElement} - The element to process.
     * @returns {HTMLElement} - The result of the substitution.
     */

    /**
     * Parses the DOM and calls a given function for all elements that contain
     * a particular attribute. The value of the attribute determines which file
     * will be passed to the function parameter.
     * @param dom {HTMLElement} - The DOM that should be parsed.
     * @param attribute {string} - The name of the attribute containing the filename.
     * @param func {substituteFileCallback} - The callback function that handles parsing the passed file.
     */
    function substituteFile(dom, attribute, func) {
        let elements = dom.querySelectorAll(`[${attribute}]`);
        for(const index in elements) {
            const filename = elements[index].getAttribute(attribute);
            elements[index].removeAttribute(attribute);
            elements[index] = func(elements[index], path.join(sourcePath, filename));
        }
    }

    /**
     * Parses the DOM and calls a given function for all elements that contain
     * a particular attribute.
     * @param dom {HTMLElement} - The DOM that should be parsed.
     * @param attribute {string} - The name of the attribute containing the filename.
     * @param func {substituteMetadataCallback} - The callback function that handles parsing the passed file.
     */
    function substituteMetadata(dom, attribute, func) {
        let elements = dom.querySelectorAll(`[${attribute}]`);
        for(const index in elements) {
            const filename = elements[index].getAttribute(attribute);
            elements[index].removeAttribute(attribute);
            elements[index] = func(elements[index]);
        }
    }

    /*
     * File-based substitutions.
     */
    function fileMarkdown(element, filename) {
        const markdownData = readTextFile(filename);
        element.innerHTML = markdown.render(markdownData);
        return element;
    }

    function fileRaw(element, filename) {
        element.innerHTML = readTextFile(filename);
        return element;
    }

    function fileSass(element, filename) {
        element.innerHTML = sass.compile(filename).css;
        return element;
    }

    /*
     * Metadata-based substitutions.
     */
    function metadataGenerationDate(element) {
        element.innerHTML = new Date().toUTCString();
        return element;
    }

    /*
     * The line of things that tells the thing to do things.
     */
    // Read the input file.
    const htmlData = readTextFile(inputFilename);

    // Parse the incoming HTML.
    let dom = html.parse(htmlData);

    // All the various file-based substitutions!
    substituteFile(dom, "data-embed", fileRaw);
    substituteFile(dom, "data-embed-markdown", fileMarkdown);
    substituteFile(dom, "data-embed-sass", fileSass);

    // All the various metadata-based substitutions!
    substituteMetadata(dom, "data-metadata-generation-date", metadataGenerationDate);

    // Make sure that the output directory exists.
    const outputDirectory = path.dirname(outputFilename);
    fs.mkdirSync(outputDirectory, { "recursive": true });

    // Fetch the output HTML and handle any necessary post-processing.
    let outputHtml = dom.outerHTML;

    if(options.beautify) {
        outputHtml = beautify(outputHtml, { format: "html" });
    }

    if(options.minify) {
        const minifyHtmlConfig = minifyHtml.createConfiguration({
            minify_css: true,
            minify_js: true
        });

        outputHtml = minifyHtml.minify(outputHtml, minifyHtmlConfig);
    }

    // Output the resulting HTML into a new file.
    const outputFileHandle = fs.openSync(outputFilename, "w");
    fs.writeSync(outputFileHandle, outputHtml);

    return 0;
}

// Parse the command line arguments then start the process!
let args = require("yargs")(process.argv.slice(2))
    .usage("usage: $0 [options]")
    .nargs("b", 0).alias("b", "beautify").describe("b", "Beautify the resulting source")
    .nargs("i", 1).alias("i", "input").describe("i", "The input file")
    .nargs("m", 0).alias("m", "minify").describe("m", "Minify the resulting source")
    .nargs("o", 1).alias("o", "output").describe("o", "The output file")
    .help("h").alias("h", "help")
    .demandOption(["i", "o"])
    .argv;

if(args.beautify && args.minify) {
    console.log("Only one post-processing option (beautify/minify) can be specified at once, silly.");
    process.exit(1);
}

const options = {
    beautify: args.beautify ?? false,
    minify: args.minify ?? false
}

process.exit(run(args.input, args.output, options));
