import { INavData } from '@coreui/angular';
import { Me } from './models';
import { I18nService } from './i18n.service';

function branchChildren(branchId: string, t: (k: string) => string): INavData[] {
  const exact = { routerLinkActiveOptions: { exact: true } };
  return [
    { name: t('nav.dashboard'), url: `/branches/${branchId}/dashboard`, iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
    { name: t('nav.employees'), url: `/branches/${branchId}/employees`, iconComponent: { name: 'cil-people' }, linkProps: exact },
    { name: t('nav.students'), url: `/branches/${branchId}/students`, iconComponent: { name: 'cil-user' }, linkProps: exact },
    { name: t('nav.hrm'), url: `/branches/${branchId}/hrm`, iconComponent: { name: 'cil-task' }, linkProps: exact },
    { name: t('nav.courses'), url: `/branches/${branchId}/courses`, iconComponent: { name: 'cil-notes' }, linkProps: exact },
    { name: t('nav.batches'), url: `/branches/${branchId}/batches`, iconComponent: { name: 'cil-layers' }, linkProps: exact },
    { name: t('nav.payments'), url: `/branches/${branchId}/payments`, iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
    { name: t('nav.calendar'), url: `/branches/${branchId}/calendar`, iconComponent: { name: 'cil-calendar' }, linkProps: exact },
    { name: t('nav.expenses'), url: `/branches/${branchId}/expenses`, iconComponent: { name: 'cil-calculator' }, linkProps: exact }
  ];
}

export function buildNav(me: Me | null, i18n: I18nService): INavData[] {
  const t = (k: string) => i18n.t(k);
  if (!me) return [];
  const exact = { routerLinkActiveOptions: { exact: true } };

  const extras: INavData[] = [
    ...(me.role === 'ADMIN'
      ? [{ name: t('nav.subscription'), url: '/subscription', iconComponent: { name: 'cil-star' }, linkProps: exact }]
      : []),
    { name: t('nav.terms'), url: '/terms', iconComponent: { name: 'cil-description' }, linkProps: exact },
    { name: t('nav.help'), url: '/help', iconComponent: { name: 'cil-speech' }, linkProps: exact },
    { name: t('nav.logout'), url: '/logout', iconComponent: { name: 'cil-account-logout' }, linkProps: exact }
  ];

  if (me.role === 'STUDENT') {
    return [
      { name: t('nav.dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.courses'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.myPayments'), url: '/my-payments', iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
      ...extras.filter((item) => item.url !== '/subscription')
    ];
  }

  if (me.role === 'TEACHER') {
    return [
      { name: t('nav.dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.employees'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
      { name: t('nav.students'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
      { name: t('nav.leave'), url: '/leave', iconComponent: { name: 'cil-task' }, linkProps: exact },
      { name: t('nav.courses'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.calendar'), url: '/calendar', iconComponent: { name: 'cil-calendar' }, linkProps: exact },
      ...extras.filter((item) => item.url !== '/subscription')
    ];
  }

  const multi = me.role === 'ADMIN' && me.company.branchCount > 1;

  if (!multi) {
    return [
      { name: t('nav.dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
      { name: t('nav.employees'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
      { name: t('nav.students'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
      { name: t('nav.hrm'), url: '/hrm', iconComponent: { name: 'cil-task' }, linkProps: exact },
      { name: t('nav.courses'), url: '/courses', iconComponent: { name: 'cil-notes' }, linkProps: exact },
      { name: t('nav.batches'), url: '/batches', iconComponent: { name: 'cil-layers' }, linkProps: exact },
      { name: t('nav.payments'), url: '/payments', iconComponent: { name: 'cil-credit-card' }, linkProps: exact },
      { name: t('nav.calendar'), url: '/calendar', iconComponent: { name: 'cil-calendar' }, linkProps: exact },
      { name: t('nav.expenses'), url: '/expenses', iconComponent: { name: 'cil-calculator' }, linkProps: exact },
      ...extras
    ];
  }

  return [
    { name: t('nav.dashboard'), url: '/dashboard', iconComponent: { name: 'cil-speedometer' }, linkProps: exact },
    { name: t('nav.allEmployees'), url: '/employees', iconComponent: { name: 'cil-people' }, linkProps: exact },
    { name: t('nav.allStudents'), url: '/students', iconComponent: { name: 'cil-user' }, linkProps: exact },
    { name: t('nav.allHrm'), url: '/hrm', iconComponent: { name: 'cil-task' }, linkProps: exact },
    ...me.branches.map((b) => ({
      name: b.name,
      url: `/branches/${b.id}`,
      iconComponent: { name: 'cil-location-pin' as const },
      children: branchChildren(b.id, t)
    })),
    ...extras
  ];
}
