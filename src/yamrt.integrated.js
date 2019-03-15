const path = require('path');
const _ = require('lodash');
const expect = require('chai').expect;

const shellExec = require('shell-exec');

const yamrtCmd = './src/cli.js';

function yamrt (yamrtArgs) {
    return shellExec(`${yamrtCmd} ${yamrtArgs.join(' ')}`);
}

describe('YAMRT command line', function () {
    let scanOutput;

    it('should display help message', () => {
        return yamrt(['--help']).then((output) => {
            expect(output.stdout).to.contain('yamrt <path> <options>');
        });
    });

    describe('scanning own repo', () => {

        before(() => {
            const monorepoRootPath = path.resolve(path.join(__dirname, '..'));
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--debug'];
            return yamrt(yamrtArgs).then((output) => {
                scanOutput = output;
            });
        });

        it('should output package cound', () => {
            expect(scanOutput.stdout).to.contain('package count: 1');
        });
    });

    describe('publish', function () {
        const monorepoRootPath = path.resolve(path.join(__dirname, '..'));
        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--debug', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                scanOutput = output;
            });
        });

        it('should cd to package directory and execute npm publish', () => {
            expect(scanOutput.stdout).to.contain('cd ' + monorepoRootPath);
        });

    });

});

// describe.skip('YAMRT scanning unmodified private monorepo (needs npm login and some private packages to test)', function () {
//
//     this.timeout(20000);
//
//     it('should scan private repo', () => {
//
//         const monorepoRootPath = path.resolve(path.join('/Users/gulli/src/gitlab.tm.is/tm-npm-libraries'));
//         const yamrtArgs = [monorepoRootPath, '--dryrun'];
//
//         return yamrt(yamrtArgs).then((output) => {
//             console.log(output.stdout);
//         });
//     });
//
// });

// describe('publish with unpushed changes reported by git', function () {
//
//     // This test needs some manual setup to run, is therefore disabled by default.
//     // Consider automating this somehow if a regression occurs on this logic.
//     // To test: up version in package.json and commit.
//
//     let execOutput;
//
//     before(() => {
//         const monorepoRootPath = path.resolve('.');
//         const yamrtArgs = [monorepoRootPath, '--publish', '--dryrun'];
//
//         return yamrt(yamrtArgs).then((output) => {
//             execOutput = output;
//         });
//     });
//
//     it('should exit with non-zero exit code', () => {
//         expect(execOutput.code).to.equal(255)
//     });
// });

describe('YAMRT scanning directory with no projects', function () {

    it('should exit with message stating that there were no projects found', () => {
        const monorepoRootPath = path.resolve('./src');
        const yamrtArgs = [monorepoRootPath];

        return yamrt(yamrtArgs).then((output) => {
            expect(output.stdout).to.contain('No packages');
        });
    });
});