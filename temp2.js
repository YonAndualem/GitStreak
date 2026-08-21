const fs = require('fs');
const token = fs.readFileSync('.env.local', 'utf8').match(/GITHUB_TOKEN=(.*)/)[1];
fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: 'bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `query { user(login: "YonAndualem") { contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z") { contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`
  })
})
.then(res => res.json())
.then(data => {
  const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
  const days = weeks.flatMap(w => w.contributionDays);
  console.log('last 10 dates for 2026 query:', days.slice(-10));
});
