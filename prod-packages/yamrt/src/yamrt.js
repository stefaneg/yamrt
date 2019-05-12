'use strict';

const path = require('path');
const meow = require('meow');
const shellExec = require('shell-exec');

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
          --force               Force publishing over normal objections. Has no effect if current version already published.           
          --verifyModified      Run verification script on modified packages. For npm packages, this is prepublishOnly.           
          
        Will publish only from git master branch with clean index and all changes pushed.   

        Examples
          $ yamrt . --publish --dryrun           # See what would be published.
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
            verifyModified:{
                type: 'boolean',
                default: false,
                alias: 'v'
            }
        }
    });

const options = {
    cwd: path.resolve(cli.input[0] || ( process.cwd())),
    publish: cli.flags.publish,
    dryRun: cli.flags.dryrun,
    debug: cli.flags.debug,
    force: cli.flags.force,
    verifyModified: cli.flags.verifyModified
};

if (options.debug) {
    console.debug = console.log;
} else {
    console.debug = () => {};
}

if(options.help){
    console.debug('Help shown, exiting')
    return process.exit(0)
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
                gitStatusMessage = 'Unpushed changes in project. Execute git status for details.';
            } else {
                gitStatusMessage = 'Uncommitted changes in project. Execute git status for details.';
            }
        } else {
            gitStatusAllowsPublish = true;
        }
    } else{
        gitStatusMessage = "No git status found";
        gitStatusAllowsPublish = false;
    }
    return {
        gitStatusAllowsPublish: gitStatusAllowsPublish,
        gitStatusMessage: gitStatusMessage
    };
}

scanDirs(options.cwd).then(leaveOnlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson) => {
    const allExecutionPromises = [];
    _(dirsWithPackageJson).each((project) => {
        console.log(`${chalk.cyan(project.path)}`);

        if (project.hasPackageJson && project.packageJson) {

            project.gitPublishEffect = checkProjectGitStatus(project);

            if (project.npmJsPackage) {

                if (project.npmJsPackage['dist-tags']) {

                    const prefixedSha = 'YT' + project.dirGitSha;

                    let publishedSha = project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'][prefixedSha];


                    console.debug('project.npmJsPackage[\'dist-tags\']', project.npmJsPackage['dist-tags'])
                    project.currentCommitAlreadyPublished = (!!publishedSha);

                    console.debug(`${project.path} currentCommitAlreadyPublished`, project.currentCommitAlreadyPublished);
                    console.debug(`${project.path} publishedSha`, publishedSha);
                    console.debug(`${project.path} prefixedSha`, prefixedSha);

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

            indentedOutput(`${project.currentCommitAlreadyPublished ? 'Up to date' : 'Changes detected'} `);
            indentedOutput(`source ${project.packageJson.name}@${project.packageJson.version} | registry ${project.packageJson.name}@${project.latestPublishedVersion} `);


            if(project.gitPublishEffect.gitStatusMessage){
                indentedOutput(chalk.yellow(project.gitPublishEffect.gitStatusMessage));
            }

            if (!project.currentVersionAlreadyPublished) {

                project.willPublish = options.publish;


                if(project.currentCommitAlreadyPublished){
                    project.willPublish = options.publish && options.force;
                }

                if(!options.force){
                    project.willPublish = project.willPublish && project.gitPublishEffect.gitStatusAllowsPublish;
                }


                if (!project.willPublish && options.force) {
                    indentedOutput(chalk.yellow('Overriding non-publishable status with --force'));
                    project.willPublish = true;
                }
                if (options.publish && !project.willPublish && exitCode === 0) {
                    exitCode = -1;
                }

                const dryRunFlag = options.dryRun && ' --dry-run' || '';

                if (project.willPublish && options.publish) {

                    const prefixedSha = 'YT' + project.dirGitSha;
                    let npmCommand = `cd ${project.path} && npm publish --tag ${prefixedSha} ${dryRunFlag} &&  npm dist-tag add ${project.packageJson.name}@${project.packageJson.version} latest  ${dryRunFlag}`;
                    indentedOutput(indent + `Running command ${npmCommand}`);

                    allExecutionPromises.push(shellExec(npmCommand).then((execResult) => {
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
                if(!project.currentCommitAlreadyPublished){

                    const verifyFlagMessage = options.verifyModified && '--verifyModified flag set, running prepublishOnly' || '';
                    indentedOutput(chalk.green(`Code has changed since last publish, but version has not. ${verifyFlagMessage}`));

                    if(options.verifyModified){
                        let npmCommand = `cd ${project.path} && npm run prepublishOnly`;
                        indentedOutput(indent + `Running command ${npmCommand}`);

                        allExecutionPromises.push(shellExec(npmCommand).then((execResult) => {
                            console.log(execResult.stdout);
                            if (execResult.code !== 0) {
                                exitCode = -10;
                                console.error(`Failed to build ${project.path}!`);
                                console.error(execResult.stderr);
                            } else {
                                indentedOutput(`Prepublish successful ${chalk.green(project.path)}`);
                            }
                        }));
                    }
                } else { // No changes
                    indentedOutput(`${chalk.yellow('No changes')}`);
                }
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
    return Promise.all(allExecutionPromises)
}).then((allPublishResults)=>{
    process.exit(exitCode)
});
