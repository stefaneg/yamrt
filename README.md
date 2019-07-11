# Readme for sources

This is a monorepo for yamrt. Production packages are in ./prod-packages/

# YAMRT CLI 
Most of the documentation is here
[README.md](./prod-packages/yamrt/README.md)



### TODO

- Design console output more carefully.
- Refactor yamrt file and start unit testing :-)
- Detect package manager to use.
- Extract project scanning, hash retrieval and publish into a plugin.
- Write dockerfile detection, build and publish plug in.
   - Consider adding docker tag directives to dockerfile if missing.
- Emit information about published packages in a structured way.
  
### Ideas:
- cache registry metadata, and fetch from origin if hash of current version has NOT been published.
- Implement configuration
  - Cache location
  - Package manager to use - override detection.



### High level features to support
- Feature branch publish/deploys
- Prevent publish on branch by default
- Support building/testing on branch
- Calculating dependencies within monorepo and mark packages that need testing/updating. 
   - Automatically up dependency references
   - Automatically up version?
   - Automatically run tests?