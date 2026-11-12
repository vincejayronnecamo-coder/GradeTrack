# GradeTrack

An offline-first academic planner for tracking BSIT subjects, recording assessment scores, and planning grade goals. There is no backend, account, or external chart dependency. Charts are drawn with local HTML and CSS; student records stay in the current browser's local storage.

## Run it

Open `index.html` in a modern browser. The app uses plain JavaScript files rather than modules so it can run from a local file. No install or build step is required.

## Features

- **Dashboard:** subject count, current average, completed passing subjects, subjects at risk, recent activity, subject performance, grade distribution, and assessment coverage.
- **My subjects:** add, edit, and delete courses; set passing and target grades; create weighted assessment components with an obtained score and possible total.
- **Grade calculator:** enter assessment scores and see the weighted result update and save.
- **Target planner:** calculate the average needed on remaining assessments or see when a target is no longer reachable.
- **Performance tracker:** review progress, status, grade snapshots, and completed assessment weight by subject.
- **Grade history:** review saved score and subject updates with dates and changes.
- **Settings:** set default grades, choose percentage or a custom equivalent display scale, export or restore a JSON backup, and clear locally saved data.
- **Responsive layout:** persistent desktop navigation and a compact mobile navigation drawer, with reduced-motion support.

## Grade calculations

Each subject's component weights must add up to 100%. A component score is calculated as `(obtained score ÷ possible score) × weight`. The final grade is the sum of the component contributions.

The current completed-work grade is the weighted average of scored components only. Unfinished work is excluded instead of being counted as zero. The projected final grade assumes the current average continues across the remaining weight; it is an estimate, not a final grade. The target planner computes the weighted average required across the ungraded components and reports targets that would require more than 100% as out of reach.

The custom equivalent display maps two endpoints that you enter to 100% and 0%. It does not assume a school's scale or convert percentage grades into an official institutional result.

## Project structure

```text
GradeTrack/
├── index.html
├── css/
│   ├── style.css
│   └── responsive.css
└── js/
    ├── app.js
    ├── calculator.js
    ├── dashboard.js
    ├── performance.js
    ├── storage.js
    ├── subjects.js
    └── target-calculator.js
```

Export a backup before clearing browser data or moving to another device. Clearing a browser's site data can also remove GradeTrack records.
