const path = require('path');
const _ = require('lodash');
const expect = require('chai').expect;

const shellExec = require('shell-exec');

const yamrtCmd = './src/cli.js';

function yamrt (yamrtArgs) {
    return shellExec(`${yamrtCmd} ${yamrtArgs.join(' ')}`);
}

function cleanNodeModules (monorepoRootPath) {
    return shellExec(`rm -rf ${monorepoRootPath}/node_modules`);
}

describe('YAMRT command line', function () {
    this.timeout(20000);

    let yamrtOutput;

    it('should display help message', () => {
        return yamrt(['--help']).then((output) => {
            expect(output.stdout).to.contain('yamrt <path> <options>');
        });
    });

    describe('scanning test packages', () => {

        before(() => {
            const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages'));
            const yamrtArgs = [monorepoRootPath, '--dryrun'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            });
        });

        it('should output package count', () => {
            expect(yamrtOutput.stdout).to.contain('package count: ');
        });
    });

    describe('new module', function () {
        let moduleRelativePath = '../../../test-packages/new-module';
        const monorepoRootPath = path.resolve(path.join(__dirname, moduleRelativePath));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should execute publish', () => {
            expect(yamrtOutput.stdout).to.contain(`npm publish`);
        });

    });

    describe('publish modified code and modified version', function () {
        const packageJson = require('../../../test-packages/modified-code-modified-version/package');
        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should cd to package directory and execute npm publish', () => {
            expect(yamrtOutput.stdout).to.contain('cd ' + monorepoRootPath);
        });

        it('should add latest tag to published version', () => {
            expect(yamrtOutput.stdout).to.contain(`npm dist-tag add ${packageJson.name}@${packageJson.version} latest`);
        });

    });

    describe('modified project, unmodified version', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-unmodified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should report changed code but unchanged version', () => {
            expect(yamrtOutput.stdout).to.contain('Code has changed since last publish, but version has not.');
        });

        it('should not be built using prepublishOnly target', () => {
            expect(yamrtOutput.stdout).not.to.contain('PREPUBLISHING');
        });
    });

    describe('modified project, unmodified version, with --verifyModified flag', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-unmodified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force', '--verifyModified'];
            return cleanNodeModules(monorepoRootPath).then((rmOutput) => {

                return yamrt(yamrtArgs).then((output) => {
                    yamrtOutput = output;
                }).catch((error) => {console.log('EROROROR', error);});
            });
        });

        it('should report changed code but unchanged version', () => {
            expect(yamrtOutput.stdout).to.contain('Code has changed since last publish, but version has not. --verifyModified flag set, running prepublishOnly');
        });

        it('should run npm ci before prepublish', () => {
            expect(yamrtOutput.stdout).to.contain('npm ci');
        });

        it('should be built using prepublishOnly target', () => {
            expect(yamrtOutput.stdout).to.contain('PREPUBLISHING');
        });
    });


    describe('modified project, modified version', function () {
        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should run prepublish', () => {
            expect(yamrtOutput.stdout).to.contain('PREPUBLISHING');
        });
    });

    describe('modified project, modified version, package-lock.json present', function () {
        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version-npm'));

        before(() => {
            return shellExec(`rm -rf ${monorepoRootPath}/node_modules`).then((rmOutput) => {
                const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
                return yamrt(yamrtArgs).then((output) => {
                    yamrtOutput = output;
                }).catch((error) => {console.log('EROROROR', error);});
            });
        });

        it('should run npm ci', () => {
            expect(yamrtOutput.stdout).to.contain('npm ci');
        });
    });

    describe('modified project, modified version, yarn.lock present', function () {
        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version-yarn'));

        before(() => {
            return cleanNodeModules(monorepoRootPath).then((rmOutput) => {
                const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
                return yamrt(yamrtArgs).then((output) => {
                    yamrtOutput = output;
                }).catch((error) => {console.log('EROROROR', error);});
            });
        });

        it('should run yarn install  --frozen-lockfile', () => {
            expect(yamrtOutput.stdout).to.contain('yarn install --frozen-lockfile');
        });
    });

    describe('module not modified', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/not-modified'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should be left alone, nothing done', () => {
            expect(yamrtOutput.stdout).not.to.contain('PREPUBLISHING');
        });

    });

    describe('module ignored, --showIgnored output option', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/ignored'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force', '--showIgnored'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should show that ignore flag is not relevant any more', () => {
            expect(yamrtOutput.stdout).to.contain('ignore setting is obsolete');

        });

        it('should show that package is not published', () => {
            expect(yamrtOutput.stdout).to.contain('/test-packages/ignored is not configured to be published (yamrt-test-ignored@0.0.2)');
        });

    });

    describe('gitBranch option on testbranch', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--gitBranch', 'testbranch'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should report as not on master branch', () => {
            expect(yamrtOutput.stdout).to.contain(' Not on master branch (testbranch)');
        });

    });

    describe('gitBranch option on master branch', function () {

        const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages/modified-code-modified-version'));

        before(() => {
            const yamrtArgs = [monorepoRootPath, '--dryrun', '--publish', '--force', '--gitBranch', 'master'];
            return yamrt(yamrtArgs).then((output) => {
                yamrtOutput = output;
            }).catch((error) => {console.log('EROROROR', error);});
        });

        it('should run npm publish with dry-run option', () => {
            expect(yamrtOutput.stdout).to.contain('--dry-run');
            expect(yamrtOutput.stdout).to.contain('npm publish');
        });

    });

});

describe('output order', function () {

});

// describe.only('YAMRT scanning unmodified private monorepo (needs npm login and some private packages to test)', function () {
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
//     // This test needs manual setup to run, is therefore disabled by default.
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

xdescribe('build all test projects with --verifyall flag', function () {

    const monorepoRootPath = path.resolve(path.join(__dirname, '../../../test-packages'));

    before(() => {
        const yamrtArgs = [monorepoRootPath, '--force', '--verifyModified'];
        return yamrt(yamrtArgs).then((output) => {
            yamrtOutput = output;
            console.log('YAMRT OUTPUT STARTS');
            console.log(output.stdout);
            console.log('YAMRT OUTPUT ENDS');
        }).catch((error) => {console.log('EROROROR', error);});
    });

    it('should report prepublish on all projects', () => {
        expect(yamrtOutput.stdout).to.contain('Code has changed since last publish, but version has not. --verifyModified flag set, running prepublishOnly');
    });

    it('should report success/failure for each project run', () => {

    });

});



describe('YAMRT scanning directory with no projects', function () {

    it('should exit with message stating that there were no projects found', () => {
        const monorepoRootPath = path.resolve('./src');
        const yamrtArgs = [monorepoRootPath];

        return yamrt(yamrtArgs).then((output) => {
            expect(output.stdout).to.contain('No packages');
        });
    });
});
