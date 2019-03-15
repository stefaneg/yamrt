# YAMRT - YetAnotherMonoRepoTool
 
Not really usable yet, only published to test itself for the time being. Stay tuned. 


### TODO

- publish one project at a time, ensure consistent output (currently publish with output is async)

- much better test coverage
  - Better test method for GIT state dependent stuff. 
  - Better test method for executing tool with parameters.


- execute tests in CircleCI
- Exit code 0 if version has not changed even if sources changed (no forcing publish on every push).
- Exit code on errors.


#### Ideas:
- sample jenkins file
- support plugins. Implement some core functionality as plugins and also use for testing monorepo tool.