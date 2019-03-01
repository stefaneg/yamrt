'use strict';

console.log('ARGV', process.argv);
const path = require('path');
const meow = require('meow');
const isCI = require('is-ci');
// const createCallsiteRecord = require('callsite-record');
// const pkg = require('../package.json');
// const npmCheck = require('./index');
// const staticOutput = require('./out/static-output');
// const interactiveUpdate = require('./out/interactive-update');
// const updateAll = require('./out/update-all');
// const debug = require('./state/debug');
const pkgDir = require('pkg-dir');
// const detectPreferredPM = require('preferred-pm');
const _ = require('lodash');

const chalk = require('chalk');

const cli = meow({
        help: `
        Usage
          $ yamrt <path> <options>

        Path
          Root directory of monorepo directory structure.

        Options
          --debug               Debug output.
          --dryrun              Run to the end without doing any permanent damage, such as publishing pacakges.
          --all-packages        Ignore modification detection and execute on all found packages.           

        Examples
          $ yamrt . publish --dryrun           # See what would be published.
    `
    },
    {
        booleanDefault: undefined,
        flags: {
            publish: {
                type: 'boolean',
                default: false,
                alias: 'p'
            },
            dryrun: {
                type: 'boolean',
                default: false
            },
            debug: {
                type: 'boolean',
                default: false,
                alias: 'd'
            },
            package: {
                type: 'string',
                default: '',
                alias: 'pkg'
            },
        }
    });

const options = {
    cwd: path.resolve(cli.input[0] || (pkgDir.sync() || process.cwd())),
    publish: cli.flags.publish,
    dryRun: cli.flags.dryrun,
    debug: cli.flags.debug
};

if (options.debug) {
    console.debug = console.log;
} else {
    console.debug = () => {};
}

console.log('Running MRT with options', options);

const scanDirs = require('./scanDirectory');
const addPackageJson = require('./package-augment/loadPackageJson');
const npmjs = require('./package-augment/get-npmjs-package-info');
const addGitSha = require('./package-augment/addGitSha');
const addGitStatus = require('./package-augment/addGitState');

let augmentPackageJson = (packageJsonDir) => {
    return Promise.resolve(packageJsonDir).then(addPackageJson).then(addGitSha).then(npmjs).then(addGitStatus);
};

let loadPackageJson = (packageDirs) => {
    return Promise.all(_(packageDirs).map(augmentPackageJson).value());
};

let onlyPackageJsonDirs = (dirs) => dirs.filter((dir) => dir.hasPackageJson);

const indent = '    ';

const packageOutput = (outputString) => {
    console.log(indent + outputString);
};

scanDirs(options.cwd).then(onlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson) => {
    _(dirsWithPackageJson).each((project) => {
        console.log(`${chalk.bgBlue(project.path)}`);

        if (project.hasPackageJson && project.packageJson) {
            if (project.npmJsPackage && project.npmJsPackage['dist-tags']) {

                const prefixedSha = 'YT' + project.dirGitSha;

                project.currentVersionAlreadyPublished = !!(project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'][prefixedSha]);

                packageOutput(`${project.path} (${project.packageJson.name}) -> ${project.currentVersionAlreadyPublished ? 'Up to date' : 'Needs publishing'} `);

                if (!project.currentVersionAlreadyPublished) {
                    if (project.gitStatus) {
                        if (project.gitStatus.branch !== 'master') {
                            packageOutput(chalk.yellow('Not on master branch, this tool only publishes on master branch.'));
                        } else if (project.gitStatus.modified) {
                            if(project.gitStatus.ahead){
                                packageOutput(chalk.yellow('Unpushed changes in project, can not publish. Execute git status for details.'));
                            }else{
                                packageOutput(chalk.yellow('Uncommitted changes in project, can not publish. Execute git status for details.'));
                            }
                        } else {
                            if (options.publish) {
                                let cmd = `npm publish --tag ${prefixedSha}`;
                                if (options.dryRun) {
                                    cmd = cmd + ' --dry-run';
                                }
                                packageOutput(indent + `Running command ${cmd}`);
                                const shellExec = require('shell-exec');
                                shellExec(cmd).then((execResult) => {
                                    console.log(execResult.stdout);
                                    if (execResult.code !== 0) {
                                        console.error(`Failed to publish ${project.path}!`);
                                        console.error(execResult.stderr);
                                    } else {
                                        console.log(`Published ${chalk.green(project.path)}`);
                                    }
                                });
                            }
                        }
                    }
                }

            } else {
                packageOutput(`${project.path} (${project.packageJson.name}) -> Not published or has not dist-tags `);
            }
        }

        if (project.isGitDir) {
            packageOutput(`${project.path} git status ${project.gitStatus}`);
        } else {
            packageOutput(`${project.path} git status ${project.gitStatus}`);
        }

        if (project.loadErrors.length) {
            packageOutput(`${chalk.red('Load errors: ')}`);
            packageOutput(_.map(project.loadErrors, (err) => {
                return err.errorType + '  -> : ' + chalk.red(err.err.message);
            }).join('\n'));
            packageOutput('');
        }
    });
    packageOutput('Found package count: ', dirsWithPackageJson.length);
});
