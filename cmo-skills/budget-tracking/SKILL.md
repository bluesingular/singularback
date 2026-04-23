---
name: budget-tracking
description: >
  Use when tracking marketing spend against plan, flagging variances, or
  preparing budget reports.
  Triggers: "how much have we spent on marketing", "are we on budget", 
  "budget variance for Q2", "reforecast marketing spend".
  Do NOT use for company-wide financial reporting — only marketing budget.
---

# Budget tracking

## Budget categories

| Category | Examples |
|---|---|
| Paid acquisition | Google Ads, LinkedIn Ads, Meta Ads |
| Content production | Writers, designers, video |
| Tools & software | Marketing stack subscriptions |
| Events | Sponsorships, booth fees, travel |
| PR & comms | Agency fees, distribution |
| Influencer / partnerships | Fees, gifting |
| Research | Surveys, tools, data |

## Monthly budget report format

```markdown
## Marketing budget — <month> <year>

**Total budget:** <amount>
**Total spent:** <amount>
**Remaining:** <amount>
**% used:** <n>% (<on track / at risk / over>)

### By category
| Category | Budget | Spent | Remaining | Status |
|---|---|---|---|---|
| Paid acquisition | | | | |
| Content | | | | |
| Tools | | | | |
| Events | | | | |
| Total | | | | |

### Variances (+/-)
- <category>: <amount> over/under — reason: <explanation>

### Forecast to month end
<Expected total spend vs budget>

### Recommended actions
- <specific action if at risk>
```

## Flagging rules
- > 80% spent with > 10 days remaining → flag to manager
- Any single item > 20% of category budget → flag before committing
- Unplanned spend request > 5% of monthly budget → requires board approval

Always update the budget tracking comment on the relevant task after any spend is confirmed.
