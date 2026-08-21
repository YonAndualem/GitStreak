const fs = require('fs');
const token = fs.readFileSync('.env.local', 'utf8').match(/GITHUB_TOKEN=(.*)/)[1];
fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: 'bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: `query { user(login: "YonAndualem") { 
      year2026: contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-12-31T23:59:59Z") { 
        contributionCalendar { weeks { contributionDays { date contributionCount } } } 
      } 
    } }`
  })
})
.then(res => res.json())
.then(data => {
  const weeks = data.data.user.year2026.contributionCalendar.weeks;
  const days = weeks.flatMap(w => w.contributionDays);
  console.log('August 21st count in year2026 query:', days.find(d => d.date === '2026-08-21'));
});
