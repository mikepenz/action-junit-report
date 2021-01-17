const core = require('@actions/core');
const github = require('@actions/github');
const nock = require('nock');
const action = require('./action');
const {
    finishedWithFailures,
    finishedSuccess,
    nothingFound,
    masterSuccess
} = require('./action.test.fixtures');

jest.setTimeout(20000);

let inputs = {};

describe('action should work', () => {
    beforeAll(() => {
        // https://github.com/actions/checkout/blob/v2.1.0/__test__/input-helper.test.ts
        jest.spyOn(core, 'getInput').mockImplementation(name => {
            return inputs[name];
        });

        jest.spyOn(core, 'error').mockImplementation(jest.fn());
        jest.spyOn(core, 'warning').mockImplementation(jest.fn());
        jest.spyOn(core, 'info').mockImplementation(jest.fn());
        jest.spyOn(core, 'debug').mockImplementation(jest.fn());

        github.context.payload.pull_request = {
            html_url: 'https://github.com/mikepenz/action-junit-report',
            head: { sha: 'sha123' }
        };

        jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
            return {
                owner: 'mikepenz',
                repo: 'action-junit-report'
            };
        });
    });

    beforeEach(() => {
        // Reset inputs
        inputs = {
            report_paths: '**/surefire-reports/TEST-*.xml',
            github_token: 'GITHUB_TOKEN',
            check_name: 'Test Report'
        };
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should parse surefire reports and send a check run to GitHub', async () => {
        let request = null;
        const scope = nock('https://api.github.com')
            .post('/repos/mikepenz/action-junit-report/check-runs', body => {
                request = body;
                return body;
            })
            .reply(200, {});
        await action();
        scope.done();

        expect(request).toStrictEqual(finishedWithFailures);
    });

    it('should send all ok if no tests were broken', async () => {
        inputs.report_paths = '**/surefire-reports/TEST-*AllOkTest.xml';
        let request = null;
        const scope = nock('https://api.github.com')
            .post('/repos/mikepenz/action-junit-report/check-runs', body => {
                request = body;
                return body;
            })
            .reply(200, {});
        await action();
        scope.done();

        expect(request).toStrictEqual(finishedSuccess);
    });

    it('should send failure if no test results were found', async () => {
        inputs.report_paths = '**/xxx/*.xml';
        let request = null;
        const scope = nock('https://api.github.com')
            .post('/repos/mikepenz/action-junit-report/check-runs', body => {
                request = body;
                return body;
            })
            .reply(200, {});
        await action();
        scope.done();

        expect(request).toStrictEqual(nothingFound);
    });

    it('should send reports to sha if no pr detected', async () => {
        inputs.report_paths = '**/surefire-reports/TEST-*AllOkTest.xml';
        github.context.payload.pull_request = undefined;
        github.context.sha = 'masterSha123';
        github.context.ref = 'refs/heads/master';

        let request = null;
        const scope = nock('https://api.github.com')
            .post('/repos/mikepenz/action-junit-report/check-runs', body => {
                request = body;
                return body;
            })
            .reply(200, {});
        await action();
        scope.done();

        expect(request).toStrictEqual(masterSuccess);
    });
});
