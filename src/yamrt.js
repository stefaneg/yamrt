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
          --force               Force publishing over normal objections. Has no effect if current version already published.           
          
        Will publish only from git master branch with clean index and all changes pushed.   

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

function checkProjectGitStatus (project) {
    let gitStatusAllowsPublish = true;
    let gitStatusMessage = '';
    if (project.gitStatus) {
        if (project.gitStatus.branch !== 'master') {
            gitStatusAllowsPublish = false;
            gitStatusMessage = 'Not on master branch, will only publish from master branch.';
        } else if (project.gitStatus.modified) {
            gitStatusAllowsPublish = false;
            if (project.gitStatus.ahead) {
                gitStatusMessage = 'Unpushed changes in project, will not publish. Execute git status for details.';
            } else {
                gitStatusMessage = 'Uncommitted changes in project, will not publish. Execute git status for details.';
            }
        } else {
            gitStatusAllowsPublish = true;
        }
    }
    return {
        gitStatusAllowsPublish: gitStatusAllowsPublish,
        gitStatusMessage: gitStatusMessage
    };
}

scanDirs(options.cwd).then(leaveOnlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson) => {
    const allPublishPromises = [];
    _(dirsWithPackageJson).each((project) => {
        console.log(`${chalk.bgBlue(project.path)}`);

        if (project.hasPackageJson && project.packageJson) {

            project.gitPublishEffect = checkProjectGitStatus(project);

            if (project.npmJsPackage) {

                if (project.npmJsPackage['dist-tags']) {

                    const prefixedSha = 'YT' + project.dirGitSha;

                    let publishedSha = project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'][prefixedSha];

                    project.currentCommitAlreadyPublished = (publishedSha === prefixedSha);

                    project.latestPublishedVersion = project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'].latest;
                    project.currentVersionAlreadyPublished = (project.latestPublishedVersion === project.packageJson.version);
                } else {
                    projectInfo.loadExceptions.push({
                        errorType: 'package-no-dist-tags',
                        error: new Error(`${project.path} (${project.packageJson.name}) -> has no dist-tags !!! `)
                    });

                    project.currentCommitAlreadyPublished = false;
                    project.currentVersionAlreadyPublished = false;
                }
            } else {
                project.currentCommitAlreadyPublished = false;
                project.currentVersionAlreadyPublished = false;
            }

            console.log(`${project.path} -> ${project.currentCommitAlreadyPublished ? 'Up to date' : 'Needs publishing'} `);
            indentedOutput(`${project.packageJson.name}@${project.packageJson.version} -> ${project.latestPublishedVersion} in registry `);


            if (!project.currentVersionAlreadyPublished) {

                project.willPublish = options.publish;


                if(project.currentCommitAlreadyPublished){
                    project.willPublish = options.publish && options.force;
                }

                if(!options.force){
                    project.willPublish = project.willPublish && project.gitPublishEffect.gitStatusAllowsPublish;
                }

                if(project.gitPublishEffect.gitStatusMessage){
                    indentedOutput(chalk.yellow(project.gitPublishEffect.gitStatusMessage));
                }


                if (!project.willPublish && options.force) {
                    indentedOutput(chalk.yellow('Overriding non-publishable status with --force'));
                    project.willPublish = true;
                }
                if (options.publish && !project.willPublish && exitCode === 0) {
                    exitCode = -1;
                }

                if (project.willPublish && options.publish) {

                    const prefixedSha = 'YT' + project.dirGitSha;
                    const dryRunFlag = options.dryRun && ' --dry-run' || '';
                    let publishCommand = `cd ${project.path} && npm publish --tag ${prefixedSha} ${dryRunFlag} &&  npm dist-tag add ${project.packageJson.name}@${project.packageJson.version} latest  ${dryRunFlag}`;
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
            } else {

                indentedOutput(`${chalk.yellow('Current version already published')}`);
            }
        }

        if (project.isGitRepoDir) {
            console.debug(`${project.path} git status ${project.gitStatus}`);
        } else {
            console.debug(`${project.path} not a a git root directory ${JSON.stringify(project.gitStatus)}`);
        }

        if (project.loadExceptions.length) {
            indentedOutput(`${chalk.yellow('Exceptions occurred collecting information: ')}`);
            indentedOutput(_.map(project.loadExceptions, (err) => {
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
