import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, studentGuard, teacherGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'authentication',
    canActivate: [guestGuard],
    loadChildren: () => import('./views/authentication/routes').then((m) => m.routes)
  },
  {
    path: '',
    loadComponent: () => import('./layout').then((m) => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'students/import',
        loadComponent: () =>
          import('./views/members/members-import.component').then((m) => m.MembersImportComponent)
      },
      {
        path: 'students',
        loadComponent: () => import('./views/members/members.component').then((m) => m.MembersComponent)
      },
      {
        path: 'employees',
        loadComponent: () => import('./views/employees/employees.component').then((m) => m.EmployeesComponent)
      },
      {
        path: 'hrm',
        loadComponent: () => import('./views/hrm/hrm.component').then((m) => m.HrmComponent)
      },
      {
        path: 'payments',
        loadComponent: () => import('./views/payments/payments.component').then((m) => m.PaymentsComponent)
      },
      {
        path: 'my-payments',
        canActivate: [studentGuard],
        loadComponent: () => import('./views/payments/my-payments.component').then((m) => m.MyPaymentsComponent)
      },
      {
        path: 'courses',
        loadComponent: () => import('./views/courses/courses.component').then((m) => m.CoursesComponent)
      },
      {
        path: 'batches',
        loadComponent: () => import('./views/batches/batches.component').then((m) => m.BatchesComponent)
      },
      {
        path: 'leave',
        canActivate: [teacherGuard],
        loadComponent: () => import('./views/leave/leave.component').then((m) => m.LeaveComponent)
      },
      {
        path: 'expenses',
        loadComponent: () => import('./views/expenses/expenses.component').then((m) => m.ExpensesComponent)
      },
      {
        path: 'calendar',
        loadComponent: () => import('./views/calendar/calendar.component').then((m) => m.CalendarComponent)
      },
      {
        path: 'subscription',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./views/subscription/subscription.component').then((m) => m.SubscriptionComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./views/profile/profile.component').then((m) => m.ProfileComponent)
      },
      {
        path: 'terms',
        loadComponent: () => import('./views/content/terms.component').then((m) => m.TermsComponent)
      },
      {
        path: 'help',
        loadComponent: () => import('./views/content/help.component').then((m) => m.HelpComponent)
      },
      {
        path: 'logout',
        loadComponent: () => import('./views/logout/logout.component').then((m) => m.LogoutComponent)
      },
      {
        path: 'branches/:branchId/dashboard',
        loadComponent: () => import('./views/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'branches/:branchId/students/import',
        loadComponent: () =>
          import('./views/members/members-import.component').then((m) => m.MembersImportComponent)
      },
      {
        path: 'branches/:branchId/students',
        loadComponent: () => import('./views/members/members.component').then((m) => m.MembersComponent)
      },
      {
        path: 'branches/:branchId/employees',
        loadComponent: () => import('./views/employees/employees.component').then((m) => m.EmployeesComponent)
      },
      {
        path: 'branches/:branchId/hrm',
        loadComponent: () => import('./views/hrm/hrm.component').then((m) => m.HrmComponent)
      },
      {
        path: 'branches/:branchId/payments',
        loadComponent: () => import('./views/payments/payments.component').then((m) => m.PaymentsComponent)
      },
      {
        path: 'branches/:branchId/courses',
        loadComponent: () => import('./views/courses/courses.component').then((m) => m.CoursesComponent)
      },
      {
        path: 'branches/:branchId/batches',
        loadComponent: () => import('./views/batches/batches.component').then((m) => m.BatchesComponent)
      },
      {
        path: 'branches/:branchId/expenses',
        loadComponent: () => import('./views/expenses/expenses.component').then((m) => m.ExpensesComponent)
      },
      {
        path: 'branches/:branchId/calendar',
        loadComponent: () => import('./views/calendar/calendar.component').then((m) => m.CalendarComponent)
      },
      {
        path: 'branches/:branchId',
        canActivate: [adminGuard],
        loadComponent: () => import('./views/branch/branch-view.component').then((m) => m.BranchViewComponent)
      }
    ]
  },
  {
    path: 'super-admin/:key',
    loadComponent: () =>
      import('./views/subscription/super-subscription.component').then((m) => m.SuperSubscriptionComponent)
  },
  {
    path: 'error-pages',
    loadChildren: () => import('./views/error-pages/routes').then((m) => m.routes)
  },
  { path: '**', redirectTo: 'error-pages/404' }
];
