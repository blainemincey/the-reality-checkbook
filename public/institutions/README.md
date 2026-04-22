# Institution logos

Drop SVGs here named by the lowercased first word of the institution:

```
public/institutions/
├── schwab.svg
├── fidelity.svg
├── chase.svg
├── wells.svg
├── amex.svg
└── capital.svg        # "Capital One"
```

Slugging rule: `institution.trim().toLowerCase()`, then take the first
alphanumeric run. "Charles Schwab" → `charles`; "Schwab & Co" → `schwab`.
If you're not sure, create an account with the institution name, refresh
`/`, and the badge tooltip (hover) shows the exact name it's trying to
match — rename the file to that slug's first word.

Square or circular logos both work; the badge crops to the inner 2/3 so
you don't need to trim padding yourself.
