import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchAllTimeContributions(username: string) {
  const userRes = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `query($login: String!) { # ${Math.random()}\n user(login: $login) { createdAt } }`,
      variables: { login: username },
    }),
  });
  
  const userData = await userRes.json();
  if (userData.errors) throw new Error(userData.errors[0].message);
  
  const createdAt = new Date(userData.data.user.createdAt);
  const currentYear = new Date().getFullYear();
  const startYear = createdAt.getFullYear();

  let queryParts = [];
  for (let year = startYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    queryParts.push(`
      year${year}: contributionsCollection(from: "${from}", to: "${to}") {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    `);
  }

  const fullQuery = `
    query($login: String!) { # cache-buster: ${Math.random()}
      user(login: $login) {
        ${queryParts.join('\n')}
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: fullQuery, variables: { login: username } }),
  });

  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0].message);

  let allDays: any[] = [];
  let allTotal = 0;

  for (let year = startYear; year <= currentYear; year++) {
    const yearData = data.data.user[`year${year}`].contributionCalendar;
    allTotal += yearData.totalContributions;
    const days = yearData.weeks.flatMap((w: any) => w.contributionDays);
    allDays.push(...days);
  }

  // Deduplicate allDays because GitHub returns overlapping days at year boundaries
  const uniqueDaysMap = new Map();
  for (const day of allDays) {
    if (!uniqueDaysMap.has(day.date) || uniqueDaysMap.get(day.date).contributionCount < day.contributionCount) {
      uniqueDaysMap.set(day.date, day);
    }
  }
  const uniqueDays = Array.from(uniqueDaysMap.values());
  uniqueDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { allDays: uniqueDays, allTotal, createdAt };
}

function calculateStreaks(allDays: any[], allTotal: number) {
  let currentStreak = 0;
  let longestStreak = 0;
  
  let tempStreak = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  let today = new Date().toISOString().split('T')[0];
  let todayIndex = allDays.findIndex((d: any) => d.date === today);
  
  console.log('DEBUG:', { today, todayIndex, dayData: allDays[todayIndex] });

  let hasCommittedToday = false;
  if (todayIndex !== -1) {
    if (allDays[todayIndex].contributionCount > 0) {
      hasCommittedToday = true;
    }
    
    let activeIndex = todayIndex;
    if (allDays[todayIndex].contributionCount === 0) {
      activeIndex = todayIndex - 1;
    }
    
    while (activeIndex >= 0 && allDays[activeIndex].contributionCount > 0) {
      currentStreak++;
      activeIndex--;
    }
  }

  return { totalContributions: allTotal, currentStreak, longestStreak, hasCommittedToday };
}

function generateSvg(stats: any, username: string, allDays: any[], createdAt: Date) {
  // Calculate date ranges for labels
  const today = new Date();
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatDateLong = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Find the end and start of the current streak
  let streakEnd = new Date(today);
  if (!stats.hasCommittedToday && stats.currentStreak > 0) {
    streakEnd.setDate(streakEnd.getDate() - 1);
  }

  let streakStart = new Date(streakEnd);
  if (stats.currentStreak > 0) {
    streakStart.setDate(streakStart.getDate() - stats.currentStreak + 1);
  }

  // Use the actual GitHub account creation date
  const accountStart = createdAt;

  // Find longest streak dates
  let longestStart = today;
  let longestEnd = today;
  let tempStart = new Date(allDays[0]?.date || today);
  let tempStreak = 0;
  let bestStreak = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) {
      if (tempStreak === 0) tempStart = new Date(day.date);
      tempStreak++;
      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
        longestStart = new Date(tempStart);
        longestEnd = new Date(day.date);
      }
    } else {
      tempStreak = 0;
    }
  }

  return `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' style='isolation: isolate' viewBox='0 0 495 195' width='495px' height='195px' direction='ltr'>
    <style>
      @keyframes currstreak {
        0% { font-size: 3px; opacity: 0.2; }
        80% { font-size: 34px; opacity: 1; }
        100% { font-size: 28px; opacity: 1; }
      }
      @keyframes fadein {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
    </style>
    <defs>
      <clipPath id='outer_rectangle'>
        <rect width='495' height='195' rx='4.5'/>
      </clipPath>
      <mask id='mask_out_ring_behind_fire'>
        <rect width='495' height='195' fill='white'/>
        <ellipse id='mask-ellipse' cx='247.5' cy='32' rx='13' ry='18' fill='black'/>
      </mask>
    </defs>
    <g clip-path='url(#outer_rectangle)'>
      <g style='isolation: isolate'>
        <rect stroke='#E4E2E2' fill='#151515' rx='4.5' x='0.5' y='0.5' width='494' height='194'/>
      </g>
      <g style='isolation: isolate'>
        <line x1='165' y1='28' x2='165' y2='170' vector-effect='non-scaling-stroke' stroke-width='1' stroke='#E4E2E2' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
        <line x1='330' y1='28' x2='330' y2='170' vector-effect='non-scaling-stroke' stroke-width='1' stroke='#E4E2E2' stroke-linejoin='miter' stroke-linecap='square' stroke-miterlimit='3'/>
      </g>
      <g style='isolation: isolate'>
        <!-- Total Contributions big number -->
        <g transform='translate(82.5, 48)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FEFEFE' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
            ${stats.totalContributions.toLocaleString()}
          </text>
        </g>
        <!-- Total Contributions label -->
        <g transform='translate(82.5, 84)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FEFEFE' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.7s'>
            Total Contributions
          </text>
        </g>
        <!-- Total Contributions range -->
        <g transform='translate(82.5, 114)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#9E9E9E' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.8s'>
            ${formatDateLong(accountStart)} - Present
          </text>
        </g>
      </g>
      <g style='isolation: isolate'>
        <!-- Current Streak label -->
        <g transform='translate(247.5, 108)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FB8C00' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
            Current Streak
          </text>
        </g>
        <!-- Current Streak range -->
        <g transform='translate(247.5, 145)'>
          <text x='0' y='21' stroke-width='0' text-anchor='middle' fill='#9E9E9E' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 0.9s'>
            ${stats.currentStreak > 0 ? formatDate(streakStart) + ' - ' + formatDate(streakEnd) : 'No active streak'}
          </text>
        </g>
        <!-- Ring around number -->
        <g mask='url(#mask_out_ring_behind_fire)'>
          <circle cx='247.5' cy='71' r='40' fill='none' stroke='#FB8C00' stroke-width='5' style='opacity: 0; animation: fadein 0.5s linear forwards 0.4s'></circle>
        </g>
        <!-- Fire icon -->
        <g transform='translate(247.5, 19.5)' stroke-opacity='0' style='opacity: 0; animation: fadein 0.5s linear forwards 0.6s'>
          <path d='M -12 -0.5 L 15 -0.5 L 15 23.5 L -12 23.5 L -12 -0.5 Z' fill='none'/>
          <path d='M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z' fill='#FB8C00' stroke-opacity='0'/>
        </g>
        <!-- Current Streak big number -->
        <g transform='translate(247.5, 48)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FEFEFE' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='animation: currstreak 0.6s linear forwards'>
            ${stats.currentStreak}
          </text>
        </g>
      </g>
      <g style='isolation: isolate'>
        <!-- Longest Streak big number -->
        <g transform='translate(412.5, 48)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FEFEFE' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='700' font-size='28px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.2s'>
            ${stats.longestStreak}
          </text>
        </g>
        <!-- Longest Streak label -->
        <g transform='translate(412.5, 84)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#FEFEFE' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='14px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.3s'>
            Longest Streak
          </text>
        </g>
        <!-- Longest Streak range -->
        <g transform='translate(412.5, 114)'>
          <text x='0' y='32' stroke-width='0' text-anchor='middle' fill='#9E9E9E' stroke='none' font-family='"Segoe UI", Ubuntu, sans-serif' font-weight='400' font-size='12px' font-style='normal' style='opacity: 0; animation: fadein 0.5s linear forwards 1.4s'>
            ${formatDateLong(longestStart)} - ${formatDateLong(longestEnd)}
          </text>
        </g>
      </g>
    </g>
  </svg>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');
  const format = searchParams.get('format') || 'svg';

  if (!username) {
    return new NextResponse('Missing user parameter', { status: 400 });
  }

  try {
    const { allDays, allTotal, createdAt } = await fetchAllTimeContributions(username);
    const stats = calculateStreaks(allDays, allTotal);

    if (format === 'json') {
      return NextResponse.json({
        username,
        stats,
        accountStart: createdAt
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*', // Allow extension to fetch this
        }
      });
    }

    const svg = generateSvg(stats, username, allDays, createdAt);

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
