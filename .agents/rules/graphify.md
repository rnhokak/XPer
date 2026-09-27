# Graphify Code Navigation Rule

Before reading or editing code in this workspace (`d:\Workspaces\XPer`), always:

1. **Check the graph report first**: Read `d:\Workspaces\XPer\graphify-out\GRAPH_REPORT.md` to understand which community/module the relevant files belong to, identify god nodes, and understand cross-module dependencies.
2. **Use graph context to scope your reading**: Only open files that are in the same community or directly connected — avoid reading unrelated files.
3. **Check for import cycles or surprising connections** relevant to the task before making changes.
4. **After significant code changes**, remind the user to run `python -m graphify update .` to keep the graph fresh.

## Graph location
- Report: `d:\Workspaces\XPer\graphify-out\GRAPH_REPORT.md`
- Interactive HTML: `d:\Workspaces\XPer\graphify-out\graph.html`
- Raw graph: `d:\Workspaces\XPer\graphify-out\graph.json`
