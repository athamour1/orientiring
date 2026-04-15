const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/LoginPage.vue') },
    ],
  },
  {
    path: '/admin',
    component: () => import('layouts/AdminLayout.vue'),
    children: [
      { path: '', component: () => import('pages/admin/AdminDashboard.vue') },
      { path: 'events/:eventId', component: () => import('pages/admin/EventDetailsPage.vue') },
      { path: 'events/:eventId/teams', component: () => import('pages/admin/TeamsAdminPage.vue') },
      { path: 'events/:eventId/logs', component: () => import('pages/admin/EventLogsPage.vue') },
      { path: 'events/:eventId/settings', component: () => import('pages/admin/EventSettingsPage.vue') },
      { path: 'profile', component: () => import('pages/admin/AdminProfilePage.vue') }
    ]
  },
  {
    path: '/team',
    component: () => import('layouts/TeamLayout.vue'),
    children: [
      { path: 'lobby', component: () => import('pages/team/LobbyPage.vue') },
      { path: 'map', component: () => import('pages/team/MapPage.vue') },
      { path: 'scan', component: () => import('pages/team/ScanPage.vue') },
      { path: 'leaderboard', component: () => import('pages/public/LeaderboardPage.vue') }
    ]
  },
  {
    // Standalone public route — no layout wrapper, no auth needed, shareable link
    path: '/leaderboard/:eventId',
    component: () => import('pages/public/PublicLeaderboardPage.vue')
  },
  {
    path: '/public/events/:eventId/leaderboard',
    component: () => import('pages/public/PublicLeaderboardPage.vue')
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
