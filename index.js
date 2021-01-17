const core = require('@actions/core');
const action = require('./action');

(async () => {
    try {
        await action();
    } catch (error) {
        core.setFailed(error.message);
    }
})();
