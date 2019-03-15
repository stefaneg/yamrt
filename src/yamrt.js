'use strict';

const path = require('path');
const meow = require('meow');
const shellExec = require('shell-exec');

const pkgDir = require('pkg-dir');
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
            force: {
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
    debug: cli.flags.debug,
    force: cli.flags.force
};

if (options.debug) {
    console.debug = console.log;
} else {
    console.debug = () => {};
}

console.debug(`Running YAMRT with options ${JSON.stringify(options, null, 2)}`);

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

let leaveOnlyPackageJsonDirs = (dirs) => dirs.filter((dir) => dir.hasPackageJson);

const indent = '    ';

const indentedOutput = (outputString) => {
    console.log(indent + outputString);
};

let exitCode = 0;

scanDirs(options.cwd).then(leaveOnlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson) => {
    const allPublishPromises = [];
    _(dirsWithPackageJson).each((project) => {
        console.log(`${chalk.bgBlue(project.path)}`);

        if (project.hasPackageJson && project.packageJson) {
            if (project.npmJsPackage) {

                if (project.npmJsPackage['dist-tags']) {
                    const prefixedSha = 'YT' + project.dirGitSha;

                    project.currentVersionAlreadyPublished = !!(project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'][prefixedSha]);

                    console.log(`${project.path} (${project.packageJson.name}) -> ${project.currentVersionAlreadyPublished ? 'Up to date' : 'Needs publishing'} `);

                    if (!project.currentVersionAlreadyPublished) {
                        let publishable = false;
                        if (project.gitStatus) {
                            if (project.gitStatus.branch !== 'master') {
                                indentedOutput(chalk.yellow('Not on master branch, will only publish from master branch.'));
                            } else if (project.gitStatus.modified) {
                                if (project.gitStatus.ahead) {
                                    indentedOutput(chalk.yellow('Unpushed changes in project, will not publish. Execute git status for details.'));
                                } else {
                                    indentedOutput(chalk.yellow('Uncommitted changes in project, will not publish. Execute git status for details.'));
                                }
                            } else {
                                publishable = true;
                            }
                        }
                        if (!publishable && options.force && options.publish) {
                            indentedOutput(chalk.yellow('Overriding non-publishable status with --force'));
                            publishable = true;
                        }
                        if (!publishable && exitCode === 0) {
                            exitCode = -1;
                        }
                        if (publishable && options.publish) {
                            let publishCommand = `cd ${project.path} && npm publish --tag ${prefixedSha}`;
                            if (options.dryRun) {
                                publishCommand = publishCommand + ' --dry-run';
                            }
                            indentedOutput(indent + `Running command ${publishCommand}`);
                            allPublishPromises.push(shellExec(publishCommand).then((execResult) => {
                                console.log(execResult.stdout);
                                if (execResult.code !== 0) {
                                    exitCode = -10;
                                    console.error(`Failed to publish ${project.path}!`);
                                    console.error(execResult.stderr);
                                } else {
                                    if (options.dryRun) {
                                        indentedOutput(chalk.yellow(' --- dry-run ---'));
                                    }
                                    indentedOutput(`Published ${chalk.green(project.path)}`);
                                }
                            }));
                        }
                    }

                } else {
                    indentedOutput(`${project.path} (${project.packageJson.name}) -> has no dist-tags `);

                }
            } else {
                indentedOutput(`${project.path} (${project.packageJson.name}) -> Not published `);
            }
        }

        if (project.isGitRepoDir) {
            console.debug(`${project.path} git status ${project.gitStatus}`);
        } else {
            console.debug(`${project.path} not a a git root directory ${JSON.stringify(project.gitStatus)}`);
        }

        if (project.loadErrors.length) {
            indentedOutput(`${chalk.red('Load errors: ')}`);
            indentedOutput(_.map(project.loadErrors, (err) => {
                return err.errorType + '  -> : ' + chalk.red(err.err.message);
            }).join('\n'));
            indentedOutput('');
        }
    });
    if (dirsWithPackageJson.length === 0) {
        console.log('No packages found to publish');
    } else {
        console.log('Found package count: ' + dirsWithPackageJson.length);
    }
    return Promise.all(allPublishPromises)
}).then((allPublishResults)=>{
    process.exit(exitCode)
});
