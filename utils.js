const glob = require('@actions/glob');
const core = require('@actions/core');
const fs = require('fs');
const parser = require('xml-js');

const resolveFileAndLine = (file, classname, output) => {
    const filename = file ? file : classname.split('.').slice(-1)[0];
    const matches = output.match(new RegExp(`${filename}.*?:\\d+`, 'g'));
    if (!matches) return { filename: filename, line: 1 };

    const [lastItem] = matches.slice(-1);
    const [, line] = lastItem.split(':');
    core.debug(`Resolved file ${filename} and line ${line}`);

    return { filename, line: parseInt(line) };
};

const resolvePath = async filename => {
    core.debug(`Resolving path for ${filename}`);
    const globber = await glob.create(`**/${filename}.*`, { followSymbolicLinks: false });
    const searchPath = globber.getSearchPaths() ? globber.getSearchPaths()[0] : "";
    for await (const result of globber.globGenerator()) {
        core.debug(`Matched file: ${result}`);
        if(!result.includes("/build/")) {
            const path = result.slice(searchPath.length + 1)
            core.debug(`Resolved path: ${path}`);
            return path;
        }
    }
    return filename
};

async function parseFile(file) {
    core.debug(`Parsing file ${file}`);
    let count = 0;
    let skipped = 0;
    let annotations = [];

    const data = await fs.promises.readFile(file);

    const report = JSON.parse(parser.xml2json(data, { compact: true }));
    const testsuites = report.testsuite
        ? [report.testsuite]
        : Array.isArray(report.testsuites.testsuite)
            ? report.testsuites.testsuite
            : [report.testsuites.testsuite];

    for (const testsuite of testsuites) {
        if(!testsuite || !testsuite.testcase) {
            return { count, skipped, annotations };
        }

        const testcases = Array.isArray(testsuite.testcase)
            ? testsuite.testcase
            : testsuite.testcase
                ? [testsuite.testcase]
                : [];
        for (const testcase of testcases) {
            count++;
            if (testcase.skipped) skipped++;
            if (testcase.failure || testcase.error) {
                const stackTrace = (
                    (testcase.failure && testcase.failure._cdata) ||
                    (testcase.failure && testcase.failure._text) ||
                    (testcase.error && testcase.error._cdata) ||
                    (testcase.error && testcase.error._text) ||
                    ''
                ).toString().trim();

                const message = (
                    (testcase.failure && testcase.failure._attributes && testcase.failure._attributes.message) ||
                    (testcase.error && testcase.error._attributes && testcase.error._attributes.message) ||
                    stackTrace.split('\n').slice(0, 2).join('\n') || testcase._attributes.name
                ).trim();

                const { filename, line } = resolveFileAndLine(
                    testcase._attributes.file,
                    testcase._attributes.classname ? testcase._attributes.classname : testcase._attributes.name,
                    stackTrace
                );

                const path = await resolvePath(filename);
                const title = `${filename}.${testcase._attributes.name}`;
                core.info(`${path}:${line} | ${message.replace(/\n/g, ' ')}`);

                annotations.push({
                    path,
                    start_line: line,
                    end_line: line,
                    start_column: 0,
                    end_column: 0,
                    annotation_level: 'failure',
                    title,
                    message,
                    raw_details: stackTrace
                });
            }
        }
    }
    return { count, skipped, annotations };
}

const parseTestReports = async reportPaths => {
    const globber = await glob.create(reportPaths, { followSymbolicLinks: false });
    let annotations = [];
    let count = 0;
    let skipped = 0;
    for await (const file of globber.globGenerator()) {
        const { count: c, skipped: s, annotations: a } = await parseFile(file);
        if (c == 0) continue;
        count += c;
        skipped += s;
        annotations = annotations.concat(a);
    }
    return { count, skipped, annotations };
};

module.exports = { resolveFileAndLine, resolvePath, parseFile, parseTestReports };
