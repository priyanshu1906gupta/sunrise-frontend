import { INavData } from '@coreui/angular';
import { Me } from './models';
import { I18nService } from './i18n.service';

function branchChildren(branchId: string, t: (k: string, fallback: string) => string): INavData[] {
  const exact = { routerLinkActiveOptions: { exact: true } };
  return [
    { name: t('nav.dashboard', 'Dashboard'), url: `/branches/${branchId}/dashboard`, iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
    { name: t('nav.employees', 'Teacher / Staff'), url: `/branches/${branchId}/employees`, iconComponent: { name: 'cil-people' }, linkProps: exact },
    { name: t('nav.students', 'Students'), url: `/branches/${branchId}/students`, iconComponent: { name: 'cil-user' }, linkProps: exact },
    { name: t('nav.addTest', 'Add Test'), url: `/branches/${branchId}/add-tests`, iconComponent: { name: 'cil-notes' }, linkProps: exact },
    { name: t('nav.liveClass', 'Live class'), url: `/branches/${branchId}/live-classes`, iconComponent: { name: 'cil-media-play' }, linkProps: exact },
    { name: t('nav.hrm', 'HRM'), url: `/branches/${branchId}/hrm`, iconComponent: { name: 'cil-task' }, linkProps: exact },
    { name: t('nav.courses', 'Courses & Subjects'), url: `/branches/${branchId}/courses`, iconComponent: { name: 'cil-notes' }, linkProps: exact },
    { name: t('nav.batches', 'Batch'), url: `/branches/${branchId}/batches`, iconComponent: { name: 'cil-layers' }, linkProps: exact },
    { name: t('nav.payments', 'Payment'), url: `/branches/${branchId}/payments`, iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
    { name: t('nav.calendar', 'Calendar'), url: `/branches/${branchId}/calendar`, iconComponent: { name: 'cil-calendar' }, linkProps: exact },
    { name: t('nav.expenses', 'Other Expenses'), url: `/branches/${branchId}/expenses`, iconComponent: { name: 'cil-calculator' }, linkProps: exact }
  ];
}

export function buildNav(me: Me | null, i18n: I18nService): INavData[] {
  const t = (k: string, fallback: string) => {
    const value = i18n.t(k);
    return value === k ? fallback : value;
  };
  if (!me) return [];
  const exact = { routerLinkActiveOptions: { exact: true } };

  const extras: INavData[] = [
    ...(me.role === 'ADMIN'
      ? [{ name: t('nav.subscription', 'Subscription'), url: '/subscription', iconComponent: { name: 'cil-star' }, linkProps: exact }]
      : []),
    { name: t('nav.terms', 'Terms & Conditions'), url: '/terms', iconComponent: { name: 'cil-description' }, linkProps: exact },
    { name: t('nav.help', 'Help & Support'), url: '/help', iconComponent: { name: 'cil-speech' }, linkProps: exact },
    { name: t('nav.logout', 'Logout'), url: '/logout', iconComponent: { name: 'cil-account-logout' }, linkProps: exact }
  ];

  if (me.role === 'STUDENT') {
    return [
      { name: t('nav.dashboard', 'Dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.test', 'Test'), url: '/tests', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.liveClass', 'Live class'), url: '/live-classes', iconComponent: { name: 'cil-media-play' }, linkProps: exact },
      { name: t('nav.courses', 'Courses & Subjects'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches', 'Batch'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.myPayments', 'Payment Transaction'), url: '/my-payments', iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
      ...extras.filter((item) => item.url !== '/subscription')
    ];
  }

  if (me.role === 'TEACHER') {
    return [
      { name: t('nav.dashboard', 'Dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.employees', 'Teacher / Staff'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
      { name: t('nav.students', 'Students'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
      { name: t('nav.addTest', 'Add Test'), url: '/add-tests', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.liveClass', 'Live class'), url: '/live-classes', iconComponent: { name: 'cil-media-play' }, linkProps: exact },
      { name: t('nav.leave', 'Apply Leave'), url: '/leave', iconComponent: { name: 'cil-task' }, linkProps: exact },
      { name: t('nav.courses', 'Courses & Subjects'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches', 'Batch'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.calendar', 'Calendar'), url: '/calendar', iconComponent: { name: 'cil-calendar' }, linkProps: exact },
      ...extras.filter((item) => item.url !== '/subscription')
    ];
  }

  const multi = me.role === 'ADMIN' && me.company.branchCount > 1;

  if (!multi) {
    return [
      { name: t('nav.dashboard', 'Dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.employees', 'Teacher / Staff'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
      { name: t('nav.students', 'Students'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
      { name: t('nav.addTest', 'Add Test'), url: '/add-tests', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.liveClass', 'Live class'), url: '/live-classes', iconComponent: { name: 'cil-media-play' }, linkProps: exact },
      { name: t('nav.hrm', 'HRM'), url: '/hrm', iconComponent: { name: 'cil-task' }, linkProps: exact },
      { name: t('nav.courses', 'Courses & Subjects'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches', 'Batch'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.payments', 'Payment'), url: '/payments', iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
      { name: t('nav.calendar', 'Calendar'), url: '/calendar', iconComponent: { name: 'cil-calendar' }, linkProps: exact },
      { name: t('nav.expenses', 'Other Expenses'), url: '/expenses', iconComponent: { name: 'cil-calculator' }, linkProps: exact },
      ...extras
    ];
  }

  return [
    { name: t('nav.dashboard', 'Dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
    { name: t('nav.allEmployees', 'All Teachers / Staff'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
    { name: t('nav.allStudents', 'All Students'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
    { name: t('nav.allHrm', 'All HRM'), url: '/hrm', iconComponent: { name: 'cil-task' }, linkProps: exact },
    ...me.branches.map((b) => ({
      name: b.name,
      url: `/branches/${b.id}`,
      iconComponent: { name: 'cil-location-pin' as const },
      children: branchChildren(b.id, t)
    })),
    ...extras
  ];
}
