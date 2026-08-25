Upload these two paths into the root of deruwe69/sleeper-wrapper:

.github/workflows/update-snapshot.yml
scripts/update-snapshot.mjs

After committing them, open GitHub > Actions > Update Sleeper snapshot > Run workflow.
The action will create snapshot.json in the repository and refresh it every 6 hours.
