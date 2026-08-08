/**
 * The console's Sinhala string table.
 *
 * `Record<TranslationKey, string>` rather than a bare object, and that is the whole
 * point of the type: a key that exists in `en` and not here is a **compile error**,
 * not a screen that quietly falls back to English in front of a weighing-point
 * clerk. The fallback in `i18n/index.ts` stays as a runtime safety net for a build
 * that somehow ships anyway — it is not the guard.
 *
 * Keys are in en.ts's order, under the same section dividers, so the two files can
 * be read side by side. The dividers stay in English deliberately: they are for
 * whoever maintains the table, and the module names in them (M3, M14) are the
 * repository's own.
 *
 * Two rules for translating this table:
 *
 *  1. **`{{placeholders}}` are code.** The name inside the braces must match en.ts
 *     exactly — the console interpolates by name, so a translated placeholder
 *     renders as literal text.
 *  2. **Domain words follow the printed account, not the dictionary.** A supplier
 *     reads දළු ගිණුම on paper every month; a more literal translation of "Green
 *     Leaf Account" would be a second name for a document that already has one.
 */

import type { TranslationKey } from './en';

export const si: Record<TranslationKey, string> = {
  /* ─────────────────────────────── common ─────────────────────────────── */
  'common.appName': 'කොන්සෝලය',
  'common.save': 'සුරකින්න',
  'common.cancel': 'අවලංගු කරන්න',
  'common.close': 'වසන්න',
  'common.confirm': 'තහවුරු කරන්න',
  'common.search': 'සොයන්න',
  'common.filter': 'පෙරහන',
  'common.clear': 'ඉවත් කරන්න',
  'common.retry': 'නැවත උත්සාහ කරන්න',
  'common.loading': 'පූරණය වෙමින්…',
  'common.none': 'නැත',
  'common.notAvailable': 'නොමැත',
  'common.yes': 'ඔව්',
  'common.no': 'නැත',
  'common.of': '/',
  'common.previous': 'පෙර',
  'common.next': 'ඊළඟ',
  'common.rowsPerPage': 'පේළි',
  'common.showing': '{{total}}ක් අතරින් {{from}}–{{to}} පෙන්වයි',
  // The page controls are icons, so these are the only names they have — they
  // reach the clerk as a tooltip and a screen reader as the accessible name.
  'common.pagination': 'පිටු',
  'common.firstPage': 'මුල් පිටුව',
  'common.previousPage': 'පෙර පිටුව',
  'common.nextPage': 'ඊළඟ පිටුව',
  'common.lastPage': 'අවසන් පිටුව',
  'common.pageOf': 'පිටු {{total}}ක් අතරින් {{page}}',
  'common.noResults': 'පෙන්වීමට කිසිවක් නැත',
  'common.noResultsHint': 'වෙනත් සෙවුමක් උත්සාහ කරන්න, නැතහොත් පෙරහන් ඉවත් කරන්න.',
  'common.signOut': 'ඉවත් වන්න',
  'shell.signOutConfirmBody': 'කොන්සෝලයේ වැඩ කිරීම දිගටම කරගෙන යාමට නැවත පිවිසිය යුතු වේ.',
  'config.confirmSaveTitle': 'මෙම වින්‍යාස වෙනස්කම් සුරකින්නද?',
  'config.confirmSaveBody':
    'මෙම වෙනස්කම් කර්මාන්තශාලා කොන්සෝලය පුරා අනෙකුත් මොඩියුලවලට සහ සන්නාමයට බලපායි.',
  'common.copy': 'පිටපත් කරන්න',
  'common.copied': 'පිටපත් කළා',
  'common.reason': 'හේතුව',
  'common.note': 'සටහන',
  'common.actor': 'කවුරු',
  'common.when': 'කවදා',
  'common.status': 'තත්ත්වය',
  'common.actions': 'ක්‍රියා',
  'common.required': 'අවශ්‍ය',
  'common.optional': 'අත්‍යවශ්‍ය නොවේ',
  'common.back': 'ආපසු',

  /* ──────────────────────────────── shell ──────────────────────────────── */
  'shell.skipToContent': 'අන්තර්ගතයට යන්න',
  'shell.tenantBanner': '{{tenant}} පෙන්වයි',
  'shell.degradedConfig':
    'කර්මාන්තශාලා වින්‍යාසයට සම්බන්ධ විය නොහැකි විය — ඇතුළත් කර ඇති පෙරනිමි අගයන් පෙන්වයි. සන්නාමය සහ විශේෂාංග යාවත්කාලීන නොවිය හැක.',
  'shell.mockBanner':
    'ආදර්ශ දත්ත. මෙහි කිසිවක් සැබෑ වාර්තාවක් නොවේ, පිටුව නැවත පූරණය කළ පසු කිසිවක් ඉතිරි නොවේ.',
  'shell.tenantSwitcher': 'කර්මාන්තශාලාව (සංවර්ධන/ආදර්ශන පමණි)',
  /* The accessible name of the language pill. The options inside it are *not*
     translated — see i18n/languages.ts for why. */
  'shell.language': 'භාෂාව',

  /* ──────────────────────────────── splash ─────────────────────────────── */
  // The factory's name is the headline on the boot splash; this is the line under
  // it, and it says what is happening rather than naming the product again.
  'splash.subtitle': 'කාර්යාල කොන්සෝලය සූදානම් වෙමින්…',

  /* ─────────────────────────────── viewport ────────────────────────────── */
  // Shown instead of the console below tablet width (see layout/ViewportGate).
  // It has to name the device to use, not just report a problem: whoever reads
  // this is holding the wrong one.
  'viewport.tooSmallTitle': 'මෙම තිරය ඉතා කුඩාය',
  'viewport.tooSmallBody':
    'කාර්යාල කොන්සෝලය ටැබ්ලට්, ලැප්ටොප් සහ ඩෙස්ක්ටොප් සඳහා සකසා ඇත — එහි වගු සහ පිටාපිට පෝරම දුරකථනයකට නොගැළපේ. එය ටැබ්ලටයකින් හෝ පරිගණකයකින් විවෘත කරන්න; කුඩා ටැබ්ලටයක් තිරස් අතට හැරවීමට සිදු විය හැක.',
  'viewport.tooSmallSize':
    'මෙම කවුළුව {{width}} × {{height}} වේ. කොන්සෝලයට අවම වශයෙන් {{minWidth}} × {{minHeight}} අවශ්‍ය වේ.',

  /* ──────────────────────────── navigation ──────────────────────────── */
  'nav.dashboard': 'උපකරණ පුවරුව',
  'nav.teaPackets': 'තේ පැකට්',
  'nav.banners': 'ප්‍රවර්ධන බැනර්',
  'nav.suppliers': 'සැපයුම්කරුවන්',
  'nav.deliveries': 'දළු එකතු කිරීම',
  'nav.rates': 'මිල සහ මාසය අවසන් කිරීම',
  'nav.bills': 'බිල්පත්',
  'nav.payouts': 'ගෙවීම්',
  'nav.credit': 'ණය පෝලිම්',
  'nav.savings': 'ඉතුරුම්',
  'nav.changeRequests': 'වෙනස් කිරීමේ ඉල්ලීම්',
  'nav.inquiries': 'විමසුම්',
  'nav.news': 'පුවත්',
  'nav.content': 'ස්ථිර පිටු',
  'nav.notifications': 'දැනුම්දීම්',
  'nav.configuration': 'වින්‍යාසය',
  'nav.users': 'පරිශීලකයන් සහ භූමිකා',
  'nav.reports': 'වාර්තා',
  'nav.audit': 'විගණන ලොගය',
  'nav.sectionOverview': 'දළ විශ්ලේෂණය',
  'nav.sectionSupport': 'සැපයුම්කරු සහාය',
  'nav.sectionOperations': 'දෛනික කටයුතු',
  'nav.sectionMoney': 'මුදල්',
  'nav.sectionQueues': 'පෝලිම්',
  'nav.sectionContent': 'අන්තර්ගතය',
  'nav.sectionAdmin': 'පරිපාලනය',

  /* ──────────────────────────────── auth ──────────────────────────────── */
  'auth.signInTitle': 'කොන්සෝලයට පිවිසෙන්න',
  'auth.signInSubtitle': '{{factory}} සඳහා කාර්යාල ප්‍රවේශය',
  'auth.email': 'විද්‍යුත් තැපෑල',
  'auth.password': 'මුරපදය',
  'auth.signIn': 'පිවිසෙන්න',
  'auth.signingIn': 'පිවිසෙමින්…',
  'auth.mfaTitle': 'ද්වි-සාධක කේතය',
  'auth.mfaSubtitle': 'ඔබේ සත්‍යාපන යෙදුමේ ඇති ඉලක්කම් හයේ කේතය ඇතුළත් කරන්න.',
  'auth.mfaCode': 'කේතය',
  'auth.mfaVerify': 'තහවුරු කරන්න',
  'auth.mfaRequiredNote': 'කළමනාකරු සහ ඉහළ ගිණුම් සඳහා ද්වි-සාධක සත්‍යාපනය අවශ්‍ය වේ.',
  'auth.forgotPassword': 'මුරපදය අමතක වුණාද?',
  'auth.forgotPasswordHint':
    'එය නැවත සැකසීමට ඔබේ කර්මාන්තශාලා පරිපාලකගෙන් ඉල්ලා සිටින්න. කොන්සෝලයට නැවත සැකසීමේ සබැඳියක් තැපැල් කළ නොහැක.',
  'auth.supplierWrongPlace': 'සැපයුම්කරුවන් පිවිසෙන්නේ ජංගම යෙදුමෙන්, මෙතැනින් නොවේ.',
  'auth.demoCredentials': 'ආදර්ශ පිවිසුම',
  'auth.demoMfa': '(ද්වි-සාධක: {{code}})',
  'auth.demoRole.clerk': 'ලිපිකරු — වෙනස් කිරීමේ ඉල්ලීම්, සැපයුම්කරුවන්',
  'auth.demoRole.weigher': 'බර කරන්නා — දළු වාර්තා කරයි',
  'auth.demoRole.accountant': 'ගණකාධිකාරී — මිල සහ මාසය අවසන් කිරීම',
  'auth.demoRole.manager': 'කළමනාකරු — මාසය ප්‍රකාශයට පත් කරයි',
  'auth.demoRole.editor': 'සංස්කාරක — පුවත් සහ ස්ථිර පිටු ලියයි',
  'auth.demoRole.factoryAdmin': 'කර්මාන්තශාලා පරිපාලක — අන්තර්ගතය ප්‍රකාශයට පත් කරයි',
  'auth.sessionExpired': 'ඔබේ සැසිය අවසන් විය. නැවත පිවිසෙන්න.',

  /* ────────────────────────────── dashboard ────────────────────────────── */
  'dashboard.title': 'උපකරණ පුවරුව',
  'dashboard.subtitle': 'දවස එක බැල්මකින්',
  'dashboard.queues': 'පෝලිම්',
  'dashboard.queueEmpty': 'බලා සිටින කිසිවක් නැත',
  /* A queue the server reports that this version of the console has no screen for. Not
     "planned" — every module of the §18.1 scope is built; this is a newer API naming a
     queue this build has never heard of. */
  'dashboard.noScreenForQueue': 'මෙම අනුවාදයේ මේ සඳහා තිරයක් නැත',
  'dashboard.oldestWaiting': 'පැරණිතම {{age}}',
  'dashboard.slaBreaching': 'ඉලක්කය පසු කළ {{count}}ක්',
  'dashboard.todaysCollection': 'අද දළු',
  'dashboard.todaysSuppliers': 'සැපයුම්කරුවන් {{count}}ක්',
  'dashboard.todaysDeliveries': 'භාර {{count}}ක්',
  'dashboard.vsYesterday': 'ඊයේට සාපේක්ෂව {{value}}',
  'dashboard.monthCycle': 'මාසික චක්‍රය',
  'dashboard.openExceptions': 'විසඳා නැති කරුණු {{count}}ක්',
  'dashboard.noExceptions': 'විසඳා නැති කරුණු නැත',
  'dashboard.intakeTrend': 'දළු ලැබීම, පසුගිය දින 14',
  'dashboard.intakeAxisKg': 'කිලෝ',
  'dashboard.alerts': 'අවධානය අවශ්‍ය',
  'dashboard.noAlerts': 'අවධානය අවශ්‍ය කිසිවක් නැත',

  /* The §13 cycle stage is read by M1 and M3 alike, so it is not a dashboard
     label. Moved rather than duplicated: two tables for one enum drift. */
  'month.stage.collecting': 'දළු එකතු කරමින්',
  'month.stage.awaitingRate': 'වෙන්දේසි ප්‍රතිඵලය බලාපොරොත්තුවෙන්',
  'month.stage.rateEntered': 'මිල ඇතුළත් කර ඇත',
  'month.stage.billsGenerated': 'බිල්පත් සාදා ඇත',
  'month.stage.published': 'ප්‍රකාශයට පත් කර ඇත',
  'dashboard.stageHint.awaitingRate':
    '{{month}} සඳහා තවම මිලක් නැත, එබැවින් මිල මත ගණනය වන සෑම අගයක්ම බිංදුව නොව හිස්ව පෙන්වයි.',
  'dashboard.stageHint.published': '{{name}} විසින් {{date}} දින ප්‍රකාශයට පත් කරන ලදී.',

  'dashboard.queue.changeRequests': 'වෙනස් කිරීමේ ඉල්ලීම්',
  'dashboard.queue.advanceRequests': 'අත්තිකාරම්',
  'dashboard.queue.loanRequests': 'ණය',
  'dashboard.queue.manureRequests': 'පොහොර',
  'dashboard.queue.teaPacketRequests': 'තේ පැකට්',
  'dashboard.queue.inquiries': 'විමසුම්',

  'dashboard.appAdoption': 'යෙදුම් භාවිතය',
  'dashboard.appAdoptionHint': 'සැපයුම්කරුවන්ගෙන් කොපමණ දෙනෙක් සැබවින්ම එය භාවිත කරයිද',
  'dashboard.appInstalled': 'සැපයුම්කරුවන් {{total}}න් {{withApp}} දෙනෙක් පිවිස ඇත',
  'dashboard.appWithout': '{{count}} දෙනෙක් කිසිදා ස්ථාපනය කර නැත',
  'dashboard.appDevices': 'දැනුම්දීම් සඳහා උපාංග {{count}}ක් ලියාපදිංචියි',
  'dashboard.appRequestShare': 'මෙම මාසයේ යෙදුමෙන් ඉදිරිපත් කළ ඉල්ලීම්: {{value}}',
  'dashboard.adoptionTrend': 'යෙදුම් භාවිතය, පසුගිය මාස 12',
  'dashboard.adoptionTrendHint':
    'කවුන්ටරයට වඩා යෙදුමෙන් ඉදිරිපත් කළ ඉල්ලීම්වල ප්‍රතිශතය. ඉල්ලීම් නොමැති මාසයක් ශුන්‍යයක් නොව, රේඛාවේ හිඩැසකි.',
  'dashboard.contentHealth': 'අන්තර්ගතය',
  'dashboard.contentHealthHint': 'යෙදුම පෙන්වන, කිසිවෙකුට නොදන්වන ලද දේ',
  'dashboard.bannersLive': 'බැනර් මේ මොහොතේ ක්‍රියාත්මකයි',
  'dashboard.contentClean': 'ආපසු හැරීමක් හෝ නොලියූ දෙයක් නැත.',
  'dashboard.content.articlesWithGaps': 'ප්‍රකාශිත ලිපි {{count}}ක් ඉංග්‍රීසියට ආපසු හැරේ',
  'dashboard.content.bannersExpired': 'ප්‍රකාශිත බැනර් {{count}}ක කාලය අවසන් වී ඇත',
  'dashboard.content.staticPagesUnwritten': 'ස්ථාවර පිටු {{count}}ක් කිසිදා ලියා නැත',

  'dashboard.alert.missingBankDetails':
    'සැපයුම්කරුවන් {{count}}කට දළු භාර ඇතත් බැංකු විස්තර නැත — එක් එක් කරුණ විසඳන තුරු මාසය ප්‍රකාශයට පත් කළ නොහැක.',
  'dashboard.alert.slaBreach': 'වෙනස් කිරීමේ ඉල්ලීම් {{count}}ක් දින 3කට වඩා බලා සිටී.',
  'dashboard.alert.awaitingRate': '{{month}} සඳහා වෙන්දේසි ප්‍රතිඵලය තවම ඇතුළත් කර නැත.',

  /* ────────────────────────────── suppliers ────────────────────────────── */
  'suppliers.title': 'සැපයුම්කරුවන්',
  'suppliers.subtitle': 'ලේඛනය',
  'suppliers.searchPlaceholder': 'අංකය, නම හෝ ජා.හැ. අංකය සොයන්න',
  'suppliers.searchHint':
    'අංකයක් එහි කොට්ඨාසය සමඟ හෝ රහිතව ගැළපේ, උදා: 5708 හෝ MAKADURA.',
  'suppliers.column.code': 'අංකය',
  'suppliers.column.name': 'නම',
  'suppliers.column.nic': 'ජා.හැ. අංකය',
  'suppliers.column.point': 'එකතු කිරීමේ ස්ථානය',
  'suppliers.column.status': 'තත්ත්වය',
  'suppliers.column.payment': 'ගෙවන ක්‍රමය',
  'suppliers.column.savings': 'ඉතුරුම් /කිලෝ',
  'suppliers.column.app': 'යෙදුම',
  'suppliers.app.installed': 'පිවිස ඇත',
  'suppliers.app.none': 'කිසිදා ස්ථාපනය කර නැත',
  'suppliers.app.lastSignIn': 'අවසන් {{when}}',
  'suppliers.filter.appAny': 'යෙදුම: ඕනෑම',
  'suppliers.filter.appMissing': 'ස්ථාපනය කර නැත',
  'suppliers.filter.appInstalled': 'පිවිස ඇත',
  'suppliers.column.lastDelivery': 'අවසන් භාරය',
  'suppliers.column.pending': 'විසඳා නැති',
  'suppliers.status.active': 'සක්‍රීය',
  'suppliers.status.suspended': 'අත්හිටුවා ඇත',
  'suppliers.status.closed': 'වසා ඇත',
  'suppliers.payment.cheque': 'චෙක්පත',
  'suppliers.payment.bankTransfer': 'බැංකු මාරුව',
  'suppliers.payment.cash': 'මුදල්',
  'suppliers.filter.allStatuses': 'ඕනෑම තත්ත්වයක්',
  'suppliers.filter.allPoints': 'ඕනෑම එකතු කිරීමේ ස්ථානයක්',
  'suppliers.filter.anyBankDetails': 'ඕනෑම බැංකු විස්තරයක්',
  'suppliers.filter.noBankDetails': 'බැංකු විස්තර නැත',
  'suppliers.noBankDetails': 'බැංකු විස්තර නැත',
  'suppliers.optedOut': 'ඉවත් වී ඇත',

  'suppliers.detail.profile': 'තොරතුරු',
  'suppliers.detail.estate': 'වතුයාය',
  'suppliers.detail.payout': 'ගෙවීම',
  'suppliers.detail.savings': 'ඉතුරුම්',
  'suppliers.detail.credit': 'ණය',
  'suppliers.detail.activity': 'ක්‍රියාකාරකම්',
  'suppliers.detail.phone': 'දුරකථනය',
  'suppliers.detail.email': 'විද්‍යුත් තැපෑල',
  'suppliers.detail.dateOfBirth': 'උපන් දිනය',
  'suppliers.detail.homeAddress': 'නිවසේ ලිපිනය',
  'suppliers.detail.estateAddress': 'වතුයායේ ලිපිනය',
  'suppliers.detail.registered': 'ලියාපදිංචි වූ දිනය',
  'suppliers.detail.bank': 'බැංකුව',
  'suppliers.detail.branch': 'ශාඛාව',
  'suppliers.detail.accountNumber': 'ගිණුම් අංකය',
  'suppliers.detail.savingsRate': 'කිලෝවකට ඉතුරුම්',
  'suppliers.detail.savingsBalance': 'ඉතුරුම් ශේෂය',
  'suppliers.detail.creditAdvance': 'අත්තිකාරම් ශේෂය',
  'suppliers.detail.creditLoan': 'ණය ශේෂය',
  'suppliers.detail.creditManure': 'පොහොර ශේෂය',
  'suppliers.detail.pendingRequests': 'විවෘත ඉල්ලීම්',
  'suppliers.detail.counterActionsHint':
    'සැපයුම්කරුවෙකු අත්හිටුවීම සහ ඔවුන්ගේ යෙදුම් මුරපදය නැවත සැකසීම කවුන්ටර කාර්යයන් වන බැවින් ඒවා කළ හැක්කේ ලිපිකරුවාට පමණි. මෙම කර්මාන්තශාලාව වෙනස් ලෙස ක්‍රියා කරන්නේ නම්, පරිශීලකයන් සහ භූමිකා යටතේ එය වෙනස් කරන්න.',
  'suppliers.detail.suspendedBecause': 'අත්හිටුවා ඇත: {{reason}}',
  'suppliers.detail.auditTitle': 'මෙම වාර්තාවේ මෑත ක්‍රියාකාරකම්',

  'suppliers.action.edit': 'විස්තර සංස්කරණය',
  'suppliers.action.suspend': 'අත්හිටුවන්න',
  'suppliers.action.reactivate': 'නැවත සක්‍රීය කරන්න',
  'suppliers.action.reveal': 'සම්පූර්ණ අංකය පෙන්වන්න',
  'suppliers.action.resetPassword': 'යෙදුමේ මුරපදය නැවත සකසන්න',

  'suppliers.reveal.title': 'සම්පූර්ණ ගිණුම් අංකය පෙන්වන්න',
  'suppliers.reveal.body':
    'මෙය ඔබේ නම සහ ඔබ දෙන හේතුව සමඟ විගණන ලොගයේ සටහන් වේ. යමක් කිරීමට එය අවශ්‍ය විට පමණක් පෙන්වන්න.',
  'suppliers.reveal.reasonLabel': 'එය ඔබට අවශ්‍ය ඇයි?',
  'suppliers.reveal.reasonPlaceholder': 'උදා: ජූලි ගෙවීම් වටයේ බැංකු ප්‍රතික්ෂේපයක් පරීක්ෂා කිරීම',
  'suppliers.reveal.show': 'අංකය පෙන්වන්න',
  'suppliers.reveal.recorded': 'විගණන ලොගයේ {{auditId}} ලෙස සටහන් විය.',

  'suppliers.suspend.title': '{{name}} අත්හිටුවන්න',
  'suppliers.suspend.body':
    'අත්හිටුවූ සැපයුම්කරුගේ සෑම වාර්තාවක්ම ඉතිරි වේ. නැවත සක්‍රීය කරන තුරු දළු භාර සහ ඉල්ලීම් නතර වේ.',
  'suppliers.reactivate.title': '{{name}} නැවත සක්‍රීය කරන්න',
  'suppliers.reactivate.body': 'දළු භාර සහ ඉල්ලීම් වහාම නැවත ආරම්භ වේ.',
  'suppliers.reasonLabel': 'හේතුව (විගණන ලොගයේ සටහන් වේ)',

  'suppliers.resetPassword.title': 'යෙදුම් මුරපදය නැවත සකසන්න',
  'suppliers.resetPassword.body':
    'මෙය {{name}} සඳහා නව මුරපදයක් සාදන අතර ඔවුන්ට විවෘතව ඇති ඕනෑම සැසියක් අවසන් කරයි. ඔවුන්ගේ පැරණි මුරපදය වහාම ක්‍රියා විරහිත වේ.',
  'suppliers.resetPassword.beforeYouStart':
    'ඔබ කතා කරන්නේ කවුරුන් සමඟද යන්න ස්ථිර නම් පමණක් මෙය කරන්න. සැපයුම්කරු කේතයක් දන්නා ඕනෑම කෙනෙකුට දුරකථනයෙන් ඇමතිය හැක.',
  'suppliers.resetPassword.identityCheck': 'එය ඔවුන් බව ඔබ පරීක්ෂා කළේ කෙසේද?',
  'suppliers.resetPassword.identityCheckHint':
    'අවම වශයෙන් අකුරු {{min}}ක්, සහ එය ඔබේ නමට එරෙහිව සටහන් වේ. "ඔවුන් ඉල්ලුවා" යනු පරීක්ෂාවක් නොවේ.',
  'suppliers.resetPassword.identityCheckPlaceholder':
    'සැපයුම්කරු පොත 5091 සමඟ කවුන්ටරයට පැමිණියා, එස්. ප්‍රනාන්දු හඳුනාගත්තා',
  'suppliers.resetPassword.confirm': 'නව මුරපදයක් සාදන්න',
  'suppliers.resetPassword.failed': 'මුරපදයක් සාදන ලද්දේ නැත',
  'suppliers.resetPassword.issuedBody': 'මෙය දැන් ලියාගෙන සැපයුම්කරුට දෙන්න.',
  'suppliers.resetPassword.passwordLabel': 'නව මුරපදය',
  'suppliers.resetPassword.onceWarning':
    'මෙය පෙන්වන එකම අවස්ථාව මෙයයි. මෙය වසා දැමුවහොත් එය නැති වේ — ඔබට තවත් එකක් සෑදීමට සිදු වේ.',
  'suppliers.resetPassword.oneTime':
    'මෙයින් පළමු වරට පිවිසෙන විට සැපයුම්කරු තමන්ගේම මුරපදයක් තෝරාගත යුතුය, එබැවින් ඔවුන් එසේ කළ පසු මෙය ක්‍රියා විරහිත වේ. ඒ දක්වා, එය දරන ඕනෑම කෙනෙකුට ඔවුන් ලෙස පිවිසිය හැක.',
  'suppliers.resetPassword.recorded': '{{name}} ට එරෙහිව සටහන් විය, {{when}} · විගණනය {{audit}}.',
  'suppliers.resetPassword.sessionsEnded': 'විවෘත සැසි {{count}}ක් අවසන් කරන ලදී.',
  'suppliers.resetPassword.done': 'මම එය ලියාගත්තා',

  /* ──────────────────────── M9 change requests ──────────────────────── */
  'changeRequests.title': 'වෙනස් කිරීමේ ඉල්ලීම්',
  'changeRequests.subtitle': 'ගෙවීම් සහ ඉතුරුම් අනුපාත අනුමත කිරීම්',
  'changeRequests.column.supplier': 'සැපයුම්කරු',
  'changeRequests.column.type': 'වෙනස',
  'changeRequests.column.current': 'දැන් ඇති',
  'changeRequests.column.requested': 'ඉල්ලූ',
  'changeRequests.column.age': 'බලා සිටි කාලය',
  'changeRequests.column.channel': 'ඉල්ලූ පාර්ශ්වය',
  'changeRequests.type.bankDetails': 'බැංකු විස්තර',
  'changeRequests.type.paymentMethod': 'ගෙවීම් ක්‍රමය',
  'changeRequests.type.savingsRate': 'ඉතුරුම් අනුපාතය',
  'changeRequests.status.pending': 'විසඳා නැත',
  'changeRequests.status.approved': 'අනුමත කළා',
  'changeRequests.status.rejected': 'ප්‍රතික්ෂේප කළා',
  'changeRequests.channel.app': 'සැපයුම්කරු (යෙදුම)',
  'changeRequests.channel.office': 'කාර්යාලය',
  'changeRequests.filter.pending': 'විසඳා නැති',
  'changeRequests.filter.approved': 'අනුමත කළ',
  'changeRequests.filter.rejected': 'ප්‍රතික්ෂේප කළ',
  'changeRequests.filter.allTypes': 'ඕනෑම වෙනසක්',
  'changeRequests.empty': 'පෝලිම හිස්',
  'changeRequests.emptyHint': 'සෑම වෙනස් කිරීමේ ඉල්ලීමක්ම තීරණය කර ඇත.',

  'changeRequests.detail.title': 'වෙනස් කිරීමේ ඉල්ලීම',
  'changeRequests.detail.comparison': 'දැන් ඇති එක සහ ඉල්ලූ එක',
  'changeRequests.detail.currentHeading': 'දැන් සක්‍රීය',
  'changeRequests.detail.requestedHeading': 'ඉල්ලූ',
  'changeRequests.detail.submitted': '{{when}} ඉදිරිපත් කළා',
  'changeRequests.detail.waiting': '{{age}} බලා සිටී',
  'changeRequests.detail.evidence': 'සාක්ෂි',
  'changeRequests.detail.addEvidence': 'ලිපිගොනුවක් අමුණන්න',
  'changeRequests.detail.noEvidence': 'ලිපිගොනු අමුණා නැත',
  'changeRequests.detail.decision': 'තීරණය',
  'changeRequests.detail.decidedBy': '{{name}} විසින් {{when}} {{status}}',
  'changeRequests.detail.auditTitle': 'විගණන සටහන',
  'changeRequests.detail.supplierLink': 'සැපයුම්කරුගේ වාර්තාව විවෘත කරන්න',

  'changeRequests.approve': 'අනුමත කරන්න',
  'changeRequests.reject': 'ප්‍රතික්ෂේප කරන්න',
  'changeRequests.approveTitle': 'මෙම වෙනස අනුමත කරන්න',
  'changeRequests.rejectTitle': 'මෙම වෙනස ප්‍රතික්ෂේප කරන්න',
  'changeRequests.approveBody':
    'සැපයුම්කරුගේ යෙදුම ඊළඟ වර යාවත්කාලීන වන විට නව අගය පෙන්වයි, තවද මෙම තීරණය ඔබේ නම සමඟ සටහන් වේ.',
  'changeRequests.rejectBody':
    'දැන් ඇති අගය එලෙසම පවතී. සැපයුම්කරු ඔබේ සටහන හේතුව ලෙස කියවයි, එබැවින් එය ඔවුන් සඳහා ලියන්න.',
  'changeRequests.noteLabel': 'තීරණයේ සටහන',
  'changeRequests.notePlaceholderApprove': 'උදා: ගිණුම් පොත ජා.හැ. පතට එරෙහිව කවුන්ටරයේ පරීක්ෂා කළා.',
  'changeRequests.notePlaceholderReject':
    'උදා: ගිණුමේ නම ලියාපදිංචි සැපයුම්කරුගේ නමට නොගැළපේ. ගිණුම් පොත කාර්යාලයට ගෙන එන්න.',
  'changeRequests.noteHelp': 'සැපයුම්කරු මෙය කියවයි. අවම අකුරු 10ක්.',
  'changeRequests.approved': 'අනුමත කළා. යෙදුම ඊළඟ වර යාවත්කාලීන වන විට නව අගය පෙන්වයි.',
  'changeRequests.rejected': 'ප්‍රතික්ෂේප කළා. දැන් ඇති අගය වෙනස් වී නැත.',

  'changeRequests.fourEyes.title': 'මෙය තීරණය කළ හැක්කේ ඔබට නොවේ',
  'changeRequests.fourEyes.body':
    'ඔබ මෙම ඉල්ලීම සැපයුම්කරු වෙනුවෙන් ඉදිරිපත් කළ බැවින්, එය තීරණය කළ යුත්තේ වෙනත් අයෙකි. කළමනාකරුගෙන් හෝ වෙනත් ලිපිකරුවෙකුගෙන් ඉල්ලන්න.',
  'changeRequests.alreadyDecided.title': 'දැනටමත් තීරණය කර ඇත',
  'changeRequests.alreadyDecided.body':
    'පෝලිම විවෘතව තිබූ අතරතුර වෙනත් අයෙක් මෙය තීරණය කර ඇත. ඔවුන් තෝරාගත් දේ පෙන්වීමට නැවත පූරණය වෙමින්.',

  /* ─────────────────────── M7 Credit queues ─────────────────────── */
  'credit.title': 'ණය පෝලිම්',
  'credit.subtitle': 'අත්තිකාරම්, ණය සහ ණයට පොහොර',
  'credit.column.supplier': 'සැපයුම්කරු',
  'credit.column.facility': 'පහසුකම',
  'credit.column.amount': 'ඉල්ලූ මුදල',
  'credit.column.available': 'ලබා ගත හැකි',
  'credit.column.age': 'බලා සිටි කාලය',
  'credit.facility.advance': 'අත්තිකාරම්',
  'credit.facility.loan': 'ණය',
  'credit.facility.manure': 'පොහොර',
  'credit.status.pending': 'විසඳා නැත',
  'credit.status.approved': 'අනුමත කළා',
  'credit.status.rejected': 'ප්‍රතික්ෂේප කළා',
  'credit.filter.pending': 'විසඳා නැති',
  'credit.filter.approved': 'අනුමත කළ',
  'credit.filter.rejected': 'ප්‍රතික්ෂේප කළ',
  'credit.filter.allFacilities': 'ඕනෑම පහසුකමක්',
  'credit.filter.overCeiling': 'සීමාව ඉක්මවූ ඒවා පමණි',
  'credit.requested': 'ඉල්ලූ මුදල',
  'credit.empty': 'පෝලිම හිස්',
  'credit.emptyHint': 'සෑම ණය ඉල්ලීමක්ම තීරණය කර ඇත.',
  'credit.overCeilingShort': 'සීමාව ඉක්මවා',
  'credit.notEligibleShort': 'සුදුසුකම් නැත',

  'credit.eligibility.title': 'මෙම සැපයුම්කරුට ලබා ගත හැකි ප්‍රමාණය',
  'credit.eligibility.computedAt': '{{when}} ගණනය කළා',
  'credit.eligibility.eligible': 'සුදුසුකම් ඇත',
  'credit.eligibility.notEligible': 'සුදුසුකම් නැත',
  'credit.eligibility.ceiling': 'උපරිම සීමාව',
  'credit.eligibility.outstanding': 'දැනටමත් ලබාගෙන ඇති',
  'credit.eligibility.available': 'තවම ලබා ගත හැකි',
  'credit.eligibility.withinCeiling': 'සීමාව තුළ',
  'credit.eligibility.overBy': '{{amount}}කින් ඉක්මවා ඇත',
  'credit.eligibility.blocked': 'ඇයි නොහැක්කේ:',
  'credit.eligibility.working': 'මෙය ගණනය කළ ආකාරය',
  'credit.eligibility.monthsOfHistory': 'ආදායම ලැබූ අවසන් කළ මාස',
  'credit.eligibility.historyOf': 'අවශ්‍ය {{required}}ක් අතරින් {{count}}ක්',
  'credit.eligibility.historyNotRequired': '{{count}} — අත්තිකාරමක් සඳහා අවශ්‍ය නොවේ',
  'credit.eligibility.averageIncome': 'සාමාන්‍ය මාසික ගිණුම',
  'credit.eligibility.multiplier': 'ණය ගුණාකාරය',
  'credit.eligibility.lastSettledMonth': 'අවසන් වශයෙන් සමතුලිත මාසය',
  'credit.eligibility.settledRate': 'එය මිල කළ කිලෝවකට මිල',
  'credit.eligibility.pricedKgs.advance': 'මේ මාසයේ මේ දක්වා දළු',
  'credit.eligibility.pricedKgs.loan': 'මිල කළ දළු',
  'credit.eligibility.pricedKgs.manure': 'අවසන් වශයෙන් සමතුලිත මාසයේ දළු',

  /* The server names the blocker with a key; the copy lives here (BR-110). */
  'credit.reason.shortHistory':
    'මෙම පහසුකම සඳහා අවශ්‍ය තරම් ආදායම ලැබූ අවසන් කළ මාස ගණන සැපයුම්කරුට තවම නැත.',
  'credit.reason.noSettledRate':
    'වෙන්දේසි මිලක් සමඟ තවම කිසිදු මාසයක් සමතුලිත වී නැත, එබැවින් සීමාවක් ගණනය කිරීමට පදනමක් නැත.',
  'credit.reason.noLeafThisMonth':
    'මේ මාසයේ දළු කිසිවක් වාර්තා වී නැත, තවද අත්තිකාරමක් ගණනය වන්නේ දැනටමත් භාර දුන් දළු මතය.',
  'credit.reason.noCeiling': 'මෙම සැපයුම්කරු සඳහා නීතිය කිසිදු සීමාවක් ලබා නොදේ.',
  'credit.reason.fullyDrawn': 'සැපයුම්කරු මෙම පහසුකමේ සම්පූර්ණ සීමාව දැනටමත් ලබාගෙන ඇත.',

  'credit.detail.title': '{{facility}} · {{amount}}',
  'credit.detail.request': 'ඉල්ලීම',
  'credit.detail.reason': 'සැපයුම්කරු පැවසූ දේ',
  'credit.detail.manureType': 'පොහොර',
  'credit.detail.quantity': 'ප්‍රමාණය',
  'credit.detail.decision': 'තීරණය',
  'credit.detail.decidedAgainst': '{{when}} ගණනය කළ {{ceiling}} සීමාවට එරෙහිව තීරණය කළා.',
  'credit.detail.auditTitle': 'විගණන සටහන',
  'credit.detail.otherRequests': 'ඔවුන්ගේ අනෙකුත් විවෘත ඉල්ලීම්',

  'credit.approve': 'අනුමත කරන්න',
  'credit.reject': 'ප්‍රතික්ෂේප කරන්න',
  'credit.approveTitle': 'මෙම ණය අනුමත කරන්න',
  'credit.rejectTitle': 'මෙම ඉල්ලීම ප්‍රතික්ෂේප කරන්න',
  'credit.approveBody':
    'සැපයුම්කරුට {{amount}} ලබා ගත හැකි වන අතර එය ඔවුන්ගේ {{facility}} ශේෂයට එකතු වේ. එය ඔවුන්ගේ ඊළඟ ගිණුමේ අඩු කිරීමක් ලෙස නැවත පැමිණේ.',
  'credit.rejectBody':
    'කිසිවක් ගෙවන්නේ නැත. සැපයුම්කරු ඔබේ සටහන හේතුව ලෙස කියවයි, එබැවින් එය ඔවුන් සඳහා ලියන්න.',
  'credit.noteLabel': 'තීරණයේ සටහන',
  'credit.noteHelp': 'සැපයුම්කරු මෙය කියවයි. අවම අකුරු 10ක්.',
  'credit.notePlaceholderApprove':
    'උදා: මේ මාසයේ දැනටමත් බර කළ දළු සඳහා සීමාව තුළ. කවුන්ටරයේ ගෙවනු ලැබේ.',
  'credit.notePlaceholderReject':
    'උදා: සාමාන්‍ය මාසික ගිණුමේ තුන් ගුණයට වඩා වැඩි. තවත් මාස දෙකක් සමතුලිත වූ පසු නැවත ඉල්ලුම් කරන්න.',
  'credit.approved': 'අනුමත කළා. එය ඊළඟ ගිණුමෙන් අඩු කරනු ලැබේ.',
  'credit.rejected': 'ප්‍රතික්ෂේප කළා. කිසිවක් ගෙවා නැත.',

  'credit.managerDecides':
    'ණය ඉල්ලීම් තීරණය කරන්නේ කළමනාකරුවෙකි. ඔබට මෙය සහ එය පිටුපස ඇති සියල්ල කියවිය හැක, නමුත් අනුමැතිය දීම ඔබේ කාර්යයක් නොවේ.',
  'credit.fourEyes.body':
    'ඔබ මෙම ඉල්ලීම සැපයුම්කරු වෙනුවෙන් ඉදිරිපත් කළ බැවින්, එය තීරණය කළ යුත්තේ වෙනත් අයෙකි. ණය යනු මුදල් වන අතර මුදල් සඳහා ඇස් හතරක් අවශ්‍යයි.',
  'credit.overCeiling.title': 'ලබා ගත හැකි ප්‍රමාණයට වඩා වැඩි',
  'credit.overCeiling.body':
    'මෙය {{amount}} ඉල්ලා සිටින නමුත් ලබා ගත හැක්කේ {{available}} පමණි. එය මෙලෙසම අනුමත කළ නොහැක — ප්‍රතික්ෂේප කරන්න, නැතහොත් සැපයුම්කරුට කුඩා ඉල්ලීමක් ඉදිරිපත් කිරීමට කියන්න.',
  'credit.stale.title': 'අගයන් වෙනස් වී ඇත',
  'credit.stale.body':
    'මෙය විවෘතව තිබූ අතරතුර සීමාව වෙනස් විය — දළු වාර්තා විය, නැතහොත් මාසයක් ප්‍රකාශයට පත් විය. නව අගයන් පූරණය වෙමින්; තීරණය කිරීමට පෙර ඒවා කියවන්න.',

  /* ─────────────────────────── M10 Inquiries ─────────────────────────── */
  'inquiries.title': 'විමසුම්',
  'inquiries.subtitle': 'සැපයුම්කරුවන්ගෙන් ලැබෙන පණිවිඩ',
  'inquiries.searchPlaceholder': 'සැපයුම්කරු, මාතෘකාව හෝ පණිවිඩය සොයන්න',
  'inquiries.column.subject': 'පණිවිඩය',
  'inquiries.status.open': 'විවෘත',
  'inquiries.status.resolved': 'පිළිතුරු දුන්නා',
  'inquiries.status.closed': 'වසා ඇත',
  'inquiries.filter.open': 'විවෘත',
  'inquiries.filter.resolved': 'පිළිතුරු දුන්',
  'inquiries.filter.closed': 'පිළිතුරු නොදී වසා ඇති',
  'inquiries.empty': 'බලා සිටින කිසිවක් නැත',
  'inquiries.emptyHint': 'සෑම පණිවිඩයකටම පිළිතුරු දී හෝ වසා ඇත.',

  'inquiries.detail.message': 'සැපයුම්කරු ඇසූ දේ',
  'inquiries.detail.reply': 'පිළිතුර',
  'inquiries.detail.repliedBy': '{{name}} විසින් {{when}} පිළිතුරු දුන්නා',
  'inquiries.detail.closed': 'පිළිතුරු නොදී වසා ඇත',
  'inquiries.detail.closedBy': '{{name}} විසින් {{when}} වසා ඇත',
  'inquiries.detail.auditTitle': 'විගණන සටහන',
  'inquiries.detail.history': 'ඔවුන්ගේ පෙර පණිවිඩ',
  'inquiries.detail.pushSent':
    'පිළිතුරක් ඇති බව දැනුම් දෙන දැනුම්දීමක් ඔවුන්ගේ දුරකථනයට යවා ඇත — පිළිතුර ම යෙදුම තුළ පමණක් ඇත, මන්ද අගුළු තිරය කියවන්නේ එය අතේ ඇති අයෙකි.',
  'inquiries.detail.pushNotSent':
    'සැපයුම්කරු ඊළඟ වර යෙදුම විවෘත කරන විට මෙය දකියි. පිළිතුරු දුන් පණිවිඩ සඳහා ස්වයංක්‍රීය දැනුම්දීම් මෙම කර්මාන්තශාලාව සඳහා අක්‍රීය කර ඇත, එබැවින් ඔවුන්ගේ දුරකථනයට කිසිවක් යවා නැත.',

  'inquiries.reply': 'පිළිතුරු දෙන්න',
  'inquiries.sendReply': 'පිළිතුර යවන්න',
  'inquiries.close': 'පිළිතුරු නොදී වසන්න',
  'inquiries.replyTitle': 'සැපයුම්කරුට පිළිතුරු දෙන්න',
  'inquiries.closeTitle': 'පිළිතුරු නොදී වසන්න',
  'inquiries.replyBody':
    'සැපයුම්කරු යෙදුමේ කියවන්නේ මෙයයි. ඔවුන් ගැන නොව, ඔවුන්ට ලියන්න.',
  'inquiries.closeBody':
    'අනුපිටපතක්, පරීක්ෂණ පණිවිඩයක්, නැතහොත් වෙනත් තැනකට අදාළ දෙයක් සඳහා මෙය භාවිත කරන්න. සැපයුම්කරුට පිළිතුරක් නොයවයි.',
  'inquiries.replyLabel': 'ඔබේ පිළිතුර',
  'inquiries.replyHelp': 'සැපයුම්කරු මෙය කියවයි. අවම අකුරු 20ක්.',
  'inquiries.replyPlaceholder':
    'උදා: 12 වැනි දින පරීක්ෂා කර ඇතුළත් නොකළ කිලෝ 96ක දෙවන බර කිරීමක් සොයාගත්තා. එය දැන් ඔබේ ගිණුමේ ඇත.',
  'inquiries.closureNoteLabel': 'වසන්නේ ඇයි',
  'inquiries.closureNoteHelp': 'මෙය දකින්නේ කාර්යාලය පමණි. අවම අකුරු 10ක්.',
  'inquiries.closurePlaceholder': 'උදා: 4 වැනි දින පිළිතුරු දුන් පණිවිඩයේ අනුපිටපතක්.',
  'inquiries.replied': 'පිළිතුරු දුන්නා. සැපයුම්කරු ඊළඟ වර යෙදුම විවෘත කරන විට එය දකියි.',
  'inquiries.closed': 'වසා ඇත. පිළිතුරක් යවා නැත.',
  'inquiries.alreadyAnswered.title': 'දැනටමත් පිළිතුරු දී ඇත',
  'inquiries.alreadyAnswered.body':
    'මෙය විවෘතව තිබූ අතරතුර වෙනත් අයෙක් පිළිතුරු දී හෝ වසා ඇත. ඔවුන් පැවසූ දේ පෙන්වීමට නැවත පූරණය වෙමින්.',

  /* ─────────────────────────────── audit ─────────────────────────────── */
  'audit.title': 'විගණන ලොගය',
  'audit.column.when': 'කවදා',
  'audit.column.actor': 'කවුරු',
  'audit.column.action': 'ක්‍රියාව',
  'audit.column.entity': 'වාර්තාව',
  'audit.column.change': 'වෙනස',
  'audit.filter.allEntities': 'ඕනෑම වාර්තා වර්ගයක්',
  'audit.empty': 'තවම කිසිවක් සටහන් වී නැත',
  'audit.action.changeRequestApprove': 'වෙනස් කිරීමේ ඉල්ලීමක් අනුමත කළා',
  'audit.action.changeRequestReject': 'වෙනස් කිරීමේ ඉල්ලීමක් ප්‍රතික්ෂේප කළා',
  'audit.action.supplierUpdate': 'සැපයුම්කරුවෙකු සංස්කරණය කළා',
  'audit.action.supplierSuspend': 'සැපයුම්කරුවෙකු අත්හිටුවා',
  'audit.action.supplierReactivate': 'සැපයුම්කරුවෙකු නැවත සක්‍රීය කළා',
  'audit.action.supplierReveal': 'සම්පූර්ණ ගිණුම් අංකයක් බැලුවා',
  'audit.action.deliveryBatchCommit': 'බර කිරීමේ සැසියක් වාර්තා කළා',
  'audit.action.deliveryVoid': 'දළු භාරයක් අවලංගු කළා',
  'audit.action.rateSet': 'මාසික මිලක් ඇතුළත් කළා',
  'audit.action.monthExceptionResolve': 'මාසය අවසන් කිරීමේ කරුණක් විසඳුවා',
  'audit.action.monthPublish': 'මාසයක් ප්‍රකාශයට පත් කළා',
  'audit.action.billsGenerate': 'මාසයක බිල්පත් සාදුවා',
  'audit.action.payoutRunCreate': 'ගෙවීම් වටයක් සූදානම් කළා',
  'audit.action.payoutRunApprove': 'ගෙවීම් වටයක් නිකුත් කළා',
  'audit.action.payoutLinePaid': 'ගෙවීමක් වාර්තා කළා',
  'audit.action.payoutLineFailed': 'අසාර්ථක ගෙවීමක් වාර්තා කළා',
  'audit.action.creditApprove': 'ණයක් අනුමත කළා',
  'audit.action.creditReject': 'ණය ඉල්ලීමක් ප්‍රතික්ෂේප කළා',
  'audit.action.inquiryReply': 'සැපයුම්කරුවෙකුට පිළිතුරු දුන්නා',
  'audit.action.inquiryClose': 'පණිවිඩයක් පිළිතුරු නොදී වසා දැම්මා',

  'audit.action.newsCreate': 'පුවත් ලිපියක් සාදුවා',
  'audit.action.newsUpdate': 'පුවත් ලිපියක් සංස්කරණය කළා',
  'audit.action.newsTranslationSave': 'පරිවර්තනයක් සුරැක්කා',
  'audit.action.newsPublish': 'පුවත් ලිපියක් ප්‍රකාශයට පත් කළා',
  'audit.action.newsUnpublish': 'පුවත් ලිපියක් ඉවත් කළා',
  'audit.action.newsArchive': 'පුවත් ලිපියක් සංරක්ෂණය කළා',
  'audit.action.staticPageSave': 'ස්ථිර පිටුවක් සංස්කරණය කළා',
  'audit.action.staticPagePublish': 'ස්ථිර පිටුවක් ප්‍රකාශයට පත් කළා',

  'audit.action.notificationSend': 'දැනුම්දීමක් යැව්වා',
  'audit.action.notificationTrigger': 'ස්වයංක්‍රීය දැනුම්දීමක් වෙනස් කළා',

  'audit.action.configUpdate': 'වින්‍යාසය වෙනස් කළා',
  'audit.action.userCreate': 'කොන්සෝල පරිශීලකයෙකු එකතු කළා',
  'audit.action.userUpdate': 'පරිශීලකයෙකුගේ නම හෝ භූමිකා වෙනස් කළා',
  'audit.action.userSuspend': 'කොන්සෝල පරිශීලකයෙකු අත්හිටුවා',
  'audit.action.userReactivate': 'කොන්සෝල පරිශීලකයෙකු නැවත සක්‍රීය කළා',
  'audit.action.userMfaReset': 'පරිශීලකයෙකුගේ ද්වි-සාධක පිවිසුම නැවත සකස් කළා',
  'audit.action.roleUpdate': 'භූමිකාවකට කළ හැකි දේ වෙනස් කළා',

  /* ───────────────────────────── validation ───────────────────────────── */
  'validation.required': 'මෙය අවශ්‍යයි',
  'validation.email': 'වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න',
  'validation.tooLong': 'එය ඉතා දිගයි',
  'validation.min': 'ඉතා කුඩායි',
  'validation.date': 'වලංගු දිනයක් ඇතුළත් කරන්න',
  'validation.nic': 'වලංගු ජා.හැ. අංකයක් ඇතුළත් කරන්න (ඉලක්කම් 9ක් සහ V, නැතහොත් ඉලක්කම් 12ක්)',
  'validation.phone': 'වලංගු ශ්‍රී ලාංකික දුරකථන අංකයක් ඇතුළත් කරන්න',
  'validation.supplierCode': '5708 හෝ 5708 (MAKADURA) වැනි අංකයක් ඇතුළත් කරන්න',
  'validation.monthKey': '2026-07 වැනි මාසයක් ඇතුළත් කරන්න',
  'validation.ratePositive': 'මිල 0ට වඩා වැඩි විය යුතුයි',
  'validation.rateNonNegative': 'මෙය ඍණ විය නොහැක',
  'validation.rateTooLarge': 'එම මිල කර්මාන්තශාලාවට වාර්තා කළ හැකි ප්‍රමාණයට වඩා විශාලයි',
  'validation.moneyScale': 'මුදල් සඳහා දශම ස්ථාන දෙකක් පමණි',
  'validation.mfaCode': 'ඉලක්කම් හයේ කේතය ඇතුළත් කරන්න',
  'validation.noteRequired': 'සටහනක් අවශ්‍යයි',
  'validation.noteTooShort': 'අවම අකුරු 10ක් ලියන්න — සැපයුම්කරු මෙය කියවයි',
  'validation.url': 'වලංගු වෙබ් ලිපිනයක් ඇතුළත් කරන්න',
  'validation.fallbackRequired': 'ඉංග්‍රීසි පිටපත අවශ්‍යයි — සියල්ල එය වෙත ආපසු යොමු වේ',
  'validation.reasonRequired': 'හේතුවක් අවශ්‍යයි',
  'validation.replyRequired': 'පිළිතුරක් අවශ්‍යයි',
  'validation.replyTooShort': 'අවම අකුරු 20ක් ලියන්න — සැපයුම්කරු කියවන පිළිතුර මෙයයි',

  /* ─────────────────────── M3 Leaf collection ─────────────────────── */
  'deliveries.title': 'දළු එකතු කිරීම',
  'deliveries.subtitle': 'කර්මාන්තශාලාව දිනෙන් දින බර කළ දළු',
  'deliveries.date': 'දිනය',
  'deliveries.point': 'එකතු කිරීමේ ස්ථානය',
  'deliveries.allPoints': 'සියලුම එකතු කිරීමේ ස්ථාන',
  'deliveries.showVoided': 'අවලංගු කළ පේළි පෙන්වන්න',
  'deliveries.pickPointToEnter':
    'වාර්තා කිරීම ආරම්භ කිරීමට එකතු කිරීමේ ස්ථානයක් තෝරන්න — දළු භාරයක් ගොනු කරන්නේ එය බර කළ ස්ථානයට එරෙහිවය.',
  'deliveries.monthLocked':
    '{{month}} ප්‍රකාශයට පත් කර ඇති බැවින්, එහි තවත් කිසිවක් වාර්තා කිරීමට හෝ අවලංගු කිරීමට නොහැක. බිල්පත් සහ ගෙවීම් සාදන්නේ දළු දැන් ඇති ආකාරයටය.',
  'deliveries.empty': 'තවම කිසිවක් බර කර නැත',
  'deliveries.emptyHint': 'බර කිරීමේ සැසියක් වාර්තා කළ විගස පේළි මෙහි දිස් වේ.',

  'deliveries.column.recordedAt': 'වාර්තා කළ වේලාව',
  'deliveries.column.supplier': 'සැපයුම්කරු',
  'deliveries.column.point': 'ස්ථානය',
  'deliveries.column.kgs': 'කිලෝ',
  'deliveries.column.source': 'මූලාශ්‍රය',
  'deliveries.column.recordedBy': 'බර කළේ',
  'deliveries.column.line': 'පේළිය',
  'deliveries.source.manual': 'අතින් ඇතුළත් කළා',
  'deliveries.source.scaleFile': 'තරාදි ලිපිගොනුව',

  'deliveries.totalKgs': 'මුළු කිලෝ',
  'deliveries.rowCount': 'දළු භාර',
  'deliveries.supplierCount': 'සැපයුම්කරුවන්',

  'deliveries.supplierCode': 'සැපයුම්කරුගේ අංකය',
  'deliveries.supplierCodeHint': 'කොට්ඨාසය සමඟ හෝ රහිතව, උදා: 5708 හෝ 5708 (MAKADURA).',
  'deliveries.supplierCodePlaceholder': 'අංකය, ඉන්පසු Tab',
  'deliveries.kgs': 'කිලෝ',
  'deliveries.addRow': 'පේළියක් එකතු කරන්න',
  'deliveries.removeRow': 'ඉවත් කරන්න',
  'deliveries.sessionEmpty':
    'සැපයුම්කරුගේ අංකය සහ කිලෝ ටයිප් කර Enter ඔබන්න. ඔබ වාර්තා කරන තුරු කිසිවක් සුරැකෙන්නේ නැත.',
  'deliveries.sessionTable': 'මෙම බර කිරීමේ සැසියේ පේළි, තවම වාර්තා කර නැත',
  'deliveries.commit': 'පේළි {{count}}ක් වාර්තා කරන්න',
  'deliveries.committed': 'දළු භාර {{count}}ක් වාර්තා කළා',
  'deliveries.committedTotal': 'දවසේ මුළු ප්‍රමාණය දැන් {{kgs}}.',
  'deliveries.committedPartly': '{{accepted}}ක් වාර්තා කළා, {{rejected}}ක් ප්‍රතික්ෂේප විය',
  'deliveries.committedPartlyHint':
    'ප්‍රතික්ෂේප වූ පේළි එක් එක් හේතුව සමඟ තවමත් ජාලකයේ ඇත. ඒවා නිවැරදි කර නැවත වාර්තා කරන්න.',
  'deliveries.commitFailed': 'කිසිවක් වාර්තා වූයේ නැත',
  'deliveries.outlierConfirm':
    '{{kgs}} යනු මෙම සැසියේ ඉතිරි ඒවාට වඩා බොහෝ වැඩි ප්‍රමාණයකි. ටයිප් කළ ආකාරයටම වාර්තා කිරීමට නැවත Enter ඔබන්න.',

  'deliveries.error.sessionFull':
    'එක් සැසියක උපරිම පේළි {{limit}}ක් ඇත. මේවා වාර්තා කර, ඉන්පසු තවත් සැසියක් ආරම්භ කරන්න.',
  'deliveries.error.stillMatching': 'තවමත් එම අංකය සොයමින්…',
  'deliveries.error.unknownSupplier': 'එම අංකය සහිත සක්‍රීය සැපයුම්කරුවෙක් නැත.',
  'deliveries.error.kgRange': 'කිලෝ 0ට වඩා වැඩි සහ උපරිම {{max}} විය යුතුයි.',
  'deliveries.error.kgPrecision':
    'කිලෝ සඳහා දශම ස්ථාන දෙකක් පමණි — කර්මාන්තශාලාව 12.35 වාර්තා කරයි, 12.345 නොවේ.',

  'deliveries.void': 'අවලංගු කරන්න',
  'deliveries.voidedBadge': 'අවලංගු කළා',
  'deliveries.voidTitle': 'මෙම දළු භාරය අවලංගු කරන්න',
  'deliveries.voidDescription':
    '{{code}} · {{name}} සඳහා {{kgs}} වාර්තා විය. පේළිය ඔබේ හේතුව සමඟ වාර්තාවේ රැඳී සිටී — මුදල් සම්බන්ධ කිසිවක් මකා නොදමයි.',
  'deliveries.voidConfirm': 'දළු භාරය අවලංගු කරන්න',
  'deliveries.voidReasonHint':
    'අවම අකුරු {{min}}ක්. සැපයුම්කරු මෙම බර කිරීම සඳහා පත්‍රිකාවක් තබාගෙන සිටින අතර ඒ ගැන විමසිය හැක.',
  'deliveries.voided': '{{kgs}} අවලංගු කළා',
  'deliveries.voidFailed': 'දළු භාරය අවලංගු වූයේ නැත',

  /* ─────────────────── M4 Rates & month close ─────────────────── */
  'months.title': 'මිල සහ මාසය අවසන් කිරීම',
  'months.subtitle': 'වෙන්දේසි මිල, සහ මාසය අවසන් වීම නවතන්නේ කුමක්ද',
  'months.pickMonth': 'මාසය',
  'months.totalKgs': 'මේ මාසයේ දළු',
  'months.suppliers': 'සැපයුම්කරුවන්',
  'months.perKg': 'කිලෝවකට',

  'months.rateTitle': 'වෙන්දේසි මිල',
  'months.rateDescription': 'මෙම මාසය සඳහා කර්මාන්තශාලාව කිලෝවකට ගෙවන මුදල.',
  'months.ratePerKg': 'කිලෝවකට මිල',
  'months.ratePerKgHint': 'වෙන්දේසි ප්‍රතිඵලයෙන්.',
  'months.extraRatePerKg': 'කිලෝවකට අමතරව',
  'months.extraHint': 'කර්මාන්තශාලාව ඉහළින් එකතු කරන මුදල. 0 යනු සැබෑ පිළිතුරකි.',
  'months.totalPerKg': 'කිලෝවකට මුළු මුදල',
  'months.saveRate': 'මිල සුරකින්න',
  'months.updateRate': 'මිල නිවැරදි කරන්න',
  'months.enteredBy': 'ඇතුළත් කළේ',
  'months.noRateYet':
    '{{month}} සඳහා තවම මිලක් ඇතුළත් කර නැත, එබැවින් යෙදුමේ මිල මත ගණනය වන සෑම අගයක්ම බිංදුව නොව හිස්ව පෙන්වයි.',
  'months.rateLocked':
    'මෙම මාසය ප්‍රකාශයට පත් කර ඇති බැවින්, මිල වාර්තාවේ කොටසක් වන අතර එය වෙනස් කළ නොහැක.',
  'months.rateReadOnly': 'මිල ඇතුළත් කරන්නේ ගණකාධිකාරී පමණි.',
  'months.rateSaved': '{{month}} සඳහා මිල සුරැක්කා',
  'months.rateFailed': 'මිල සුරැකුණේ නැත',

  'months.error.ratePositive': 'මිල 0ට වඩා වැඩි විය යුතුයි.',
  'months.error.extraNonNegative': 'අමතර මුදල ඍණ විය නොහැක.',
  'months.error.moneyScale': 'මුදල් සඳහා දශම ස්ථාන දෙකක් පමණි.',

  'months.closeTitle': 'මාසය අවසන් කිරීම',
  'months.closeDescription': 'මාසය ප්‍රකාශයට පත් කිරීමට පෙර සෑම පියවරක්ම සම්පූර්ණ විය යුතුයි.',
  'months.closedDescription': 'මෙම මාසය අවසන් කර ඇත. එහි අගයන් දැන් වාර්තාවයි.',
  'months.step.leaf': 'දළු වාර්තා කර ඇත',
  'months.step.leafDetail':
    'සැපයුම්කරුවන් {{suppliers}}කගෙන් {{kgs}}, දළු භාර {{deliveries}}ක්.',
  'months.step.rate': 'වෙන්දේසි මිල ඇතුළත් කර ඇත',
  'months.step.rateDetail': 'කිලෝවකට {{total}}, {{name}} විසින් ඇතුළත් කළා.',
  'months.step.rateMissing': 'තවම මිලක් නැත — මිලක් නොමැතිව බිල්පත් සෑදිය නොහැක.',
  'months.step.exceptions': 'කරුණු විසඳා ඇත',
  'months.step.exceptionsClear': 'සියලුම {{total}}ක් විසඳා ඇත.',
  'months.step.exceptionsOpen': '{{count}}ක් තවම විවෘතයි.',
  'months.step.bills': 'බිල්පත් සාදා ඇත',
  'months.step.billsDetail': 'බිල්පත් {{count}}ක්, {{payable}} ගෙවිය යුතුයි.',
  'months.step.billsMissing':
    'තවම බිල්පත් සාදා නැත — ප්‍රකාශයට පත් කිරීමේදී සැපයුම්කරුවන්ට දීමට කිසිවක් නැත.',
  'months.step.billsStale':
    'බිල්පත් සෑදූ පසු දළු වෙනස් වී ඇත. අවසන් කිරීමට පෙර ඒවා නැවත සාදන්න.',
  'months.step.openBills': 'බිල්පත් වටය විවෘත කරන්න',
  'months.stepDone': '— සම්පූර්ණයි',
  'months.stepBlocked': '— තවම සම්පූර්ණ නැත',
  'months.publish': '{{month}} ප්‍රකාශයට පත් කරන්න',
  'months.blockedHint': 'පළමුව ඉහත පියවර සම්පූර්ණ කරන්න.',
  'months.irreversibleHint':
    'ප්‍රකාශයට පත් කිරීම නැවත හැරවිය නොහැක: දළු අගුළු වැටෙන අතර බිල්පත් සහ ගෙවීම් සාදන්නේ මෙම අගයන් මතය.',
  'months.fourEyesHint':
    'ඔබ මෙම මාසයේ මිල ඇතුළත් කළ බැවින්, එය ප්‍රකාශයට පත් කළ යුත්තේ වෙනත් අයෙකි (BR-501).',
  'months.publishNeedsManager': 'මාසයක් ප්‍රකාශයට පත් කිරීම කළමනාකරුගේ තීරණයකි.',
  'months.alreadyPublished': '{{name}} විසින් {{date}} දින ප්‍රකාශයට පත් කළා.',
  'months.confirmTitle': '{{month}} ප්‍රකාශයට පත් කරන්නද?',
  'months.confirmDescription':
    'මෙය නැවත හැරවිය නොහැක. මාසයේ දළු තවදුරටත් ඇතුළත් කිරීමට එරෙහිව අගුළු වැටෙන අතර සෑම බිල්පතක් සහ ගෙවීමක් සාදන්නේ පහත අගයන් මතය.',
  'months.confirmPublish': 'මාසය ප්‍රකාශයට පත් කරන්න',
  'months.publishNoteHint': 'අත්‍යවශ්‍ය නොවේ. මෙම අවසන් කිරීම ගැන කාර්යාලය දැනගත යුතු කිසිවක්.',
  'months.published': '{{month}} ප්‍රකාශයට පත් කළා',
  'months.publishFailed': 'මාසය ප්‍රකාශයට පත් වූයේ නැත',

  'months.exceptionsTitle': 'කරුණු',
  'months.exceptionsDescription':
    'අවසන් කිරීමට පෙර එක් එක් කරුණ විසඳිය යුතුයි, නැතහොත් පැහැදිලි කළ යුතුයි.',
  'months.filterExceptions': 'කුමන කරුණුද',
  'months.filter.open': 'විවෘත ({{count}})',
  'months.filter.resolved': 'විසඳූ',
  'months.filter.all': 'සියල්ල',
  'months.column.type': 'කරුණ',
  'months.column.supplier': 'සැපයුම්කරු',
  'months.column.detail': 'විස්තර',
  'months.column.raised': 'ඉදිරිපත් කළ දිනය',
  'months.exception.missingBankDetails': 'බැංකු විස්තර නැත',
  'months.exception.inactiveSupplierWithLeaf': 'අක්‍රීය සැපයුම්කරුගෙන් දළු',
  'months.exception.pendingChangeRequest': 'වෙනස් කිරීමේ ඉල්ලීම තවම විවෘතයි',
  'months.exception.outlierDelivery': 'අසාමාන්‍ය බර කිරීමක්',
  'months.openRecord': 'වාර්තාව විවෘත කරන්න',
  'months.resolve': 'විසඳන්න',
  'months.resolveTitle': 'මෙම කරුණ විසඳන්න',
  'months.resolveConfirm': 'විසඳූ බව සලකුණු කරන්න',
  'months.resolveNoteHint':
    'අවම අකුරු {{min}}ක්. මෙය මත මාසය අවසන් වූයේ ඇයිද යන්න විගණකයෙක් විමසන විට කියවන්නේ මෙයයි.',
  'months.resolvedByNote': '{{name}} විසින් විසඳුවා: {{note}}',
  'months.exceptionResolved': 'කරුණ විසඳුවා',
  'months.exceptionResolveFailed': 'කරුණ විසඳුණේ නැත',
  'months.noOpenExceptions': 'අවසන් කිරීම නවතන කිසිවක් නැත',
  'months.noOpenExceptionsHint': 'මෙම මාසය සඳහා ඉදිරිපත් වූ සෑම කරුණක්ම විසඳා ඇත.',

  /* ─────────── shared by the money modules (M5, M6, M8) ─────────── */
  'money.pickMonth': 'මාසය',

  /* ───────────────────────────── M5 Bills ───────────────────────────── */
  'bills.title': 'බිල්පත්',
  'bills.subtitle': 'දළු ගිණුම්, මාසය ප්‍රකාශයට පත් කිරීමට පෙර පරීක්ෂා කරන ලද',
  'bills.readOnlyNotice':
    'කියවීම පමණි. බිල් සකසන්නේ සහ ප්‍රකාශ කරන්නේ කර්මාන්තශාලාවේම කොන්සෝලයෙනි; සැපයුම්කරුවෙකුගේ දුරකථනයේ ඇති ගිණුම ගැන ප්‍රශ්නයකට කාර්යාලයට පිළිතුරු දිය හැකි වීමට මෙම තිරය ඇත.',
  'bills.searchPlaceholder': 'අංකය, නම හෝ බිල්පත් අංකය සොයන්න',
  'bills.lensLabel': 'පෙන්වන්න',
  'bills.lens.all': 'සියලුම බිල්පත්',
  'bills.lens.missingBankDetails': 'ගෙවිය යුතු, බැංකු විස්තර නැත',
  'bills.lens.carriesDebt': 'ගෙවිය යුතු කිසිවක් නැත',
  'bills.payableLabel': 'ගෙවිය යුතු',
  'bills.empty': 'මෙම මාසය සඳහා බිල්පත් නැත',
  'bills.emptyHint': 'වෙන්දේසි මිල ඇතුළත් කළ පසු වටය සාදන්න.',

  'bills.column.supplier': 'සැපයුම්කරු',
  'bills.column.billNo': 'බිල්පත් අංකය',
  'bills.column.kgs': 'කිලෝ',
  'bills.column.gross': 'දළ මුදල (රු.)',
  'bills.column.deductions': 'අඩු කිරීම් (රු.)',
  'bills.column.payable': 'ගෙවිය යුතු (රු.)',
  'bills.flag.unbalanced': 'එකතුව නොගැළපේ',
  'bills.flag.noBank': 'බැංකු විස්තර නැත',
  'bills.flag.carriesDebt': 'ණය ඉතිරිව ඇත',

  'bills.runTitle': 'බිල්පත් වටය',
  'bills.runDescription':
    'බිල්පතක් සාදන්නේ මාසයේ දළු සහ එහි මිල මතය. ඒ දෙකෙන් එකක් වෙනස් වන සෑම විටම නැවත සාදන්න.',
  'bills.runDescriptionClosed': 'මෙම බිල්පත් වාර්තාවයි. සැපයුම්කරුවන්ට යෙදුමේ ඒවා දැකිය හැක.',
  'bills.runBills': 'බිල්පත්',
  'bills.runKgs': 'බිල් කළ දළු',
  'bills.runGross': 'දළ මුදල',
  'bills.runDeductions': 'අඩු කිරීම්',
  'bills.runSavings': 'රඳවාගත් ඉතුරුම්',
  'bills.runCarryingDebt': 'ගෙවිය යුතු කිසිවක් නැත',
  'bills.runGeneratedBy': '{{name}} විසින් {{when}} සාදුවා.',
  'bills.notGenerated':
    '{{month}} සඳහා තවම බිල්පත් සාදා නැත. පළමුව වෙන්දේසි මිල ඇතුළත් කළ යුතුයි.',
  'bills.generate': 'බිල්පත් සාදන්න',
  'bills.generateHint':
    'මේ මාසයේ දළු ඇති සෑම සැපයුම්කරුවෙකු සඳහා එක් දළු ගිණුමක් සාදයි. මාසය ප්‍රකාශයට පත් කරන තුරු සැපයුම්කරුවන්ට කිසිවක් නොයවයි.',
  'bills.regenerate': 'බිල්පත් නැවත සාදන්න',
  'bills.regenerateHint':
    'දළු සහ මිල දැන් ඇති ආකාරයට සෑම බිල්පතක්ම නැවත ගණනය කරයි. මාසය විවෘතව ඇති විට කිහිප වතාවක් කිරීම ආරක්ෂිතයි.',
  'bills.generateReadOnly': 'බිල්පත් සාදන්නේ ගණකාධිකාරී පමණි.',
  'bills.generated': '{{month}} සඳහා බිල්පත් සාදුවා',
  'bills.generatedDetail': 'බිල්පත් {{count}}ක්, {{payable}} ගෙවිය යුතුයි.',
  'bills.generateFailed': 'බිල්පත් සෑදුණේ නැත',
  'bills.missingBankWarning':
    'ලිපිගොනුවේ බැංකු විස්තර නොමැති සැපයුම්කරුවන් {{count}}කට මුදල් ගෙවිය යුතුයි. ගිණුම් පොත ලැබෙන තුරු ගෙවීම් වටයක් එම පේළි රඳවා තබයි.',
  'bills.staleWarning':
    'මෙම බිල්පත් සෑදූ පසු දළු වෙනස් වී ඇත (එවකට {{kgs}}). ප්‍රකාශයට පත් කිරීමට පෙර නැවත සාදන්න — තවදුරටත් නොගැළපෙන අගයන් මත මාසය අවසන් කළ නොහැක.',
  'bills.publishedLock':
    'මෙම මාසය ප්‍රකාශයට පත් කර ඇති බැවින්, එහි බිල්පත් වාර්තාව වන අතර නැවත සෑදිය නොහැක.',

  'bills.detailTitle': 'දළු ගිණුම · {{code}}',
  'bills.detailSubtitle': '{{name}} · {{month}}',
  'bills.backToMonth': '{{month}} වෙත ආපසු',
  'bills.published': 'ප්‍රකාශයට පත් කළා',
  'bills.draft': 'තවම ප්‍රකාශයට පත් කර නැත',
  'bills.slipHeader': 'ගිණුම',
  'bills.billNo': 'බිල්පත් අංකය',
  'bills.month': 'මාසය',
  'bills.supplier': 'සැපයුම්කරු',
  'bills.issued': 'සාදූ දිනය',
  'bills.factoryRegNo': 'කර්මාන්තශාලා ලියාපදිංචි අංකය',
  'bills.earnings': 'දළු සහ මිල',
  'bills.noAuctionResult':
    'මෙම මාසය සඳහා වෙන්දේසි ප්‍රතිඵලයක් නැත, එබැවින් මිල මත ගණනය වන සෑම අගයක්ම බිංදුව නොව හිස්ව පෙන්වයි.',
  'bills.totalKgs': 'මුළු කිලෝ',
  'bills.greenLeafAmount': 'දළු මුදල',
  'bills.extraPayment': 'අමතර ගෙවීම',
  'bills.grossAmount': 'දළ මුදල',

  'bills.deductions': 'අඩු කිරීම්',
  'bills.deductionsPolicy':
    'මුද්‍රිත ගිණුම දරන පේළි නවය. ඒවායින් කුමන ඒවා සැපයුම්කරුවෙකු අනුව කාර්යාලයට සැකසිය හැකිද යන්න කර්මාන්තශාලාව සමඟ තවම විසඳා නැති ප්‍රශ්නයකි (§21.10), එබැවින් මෙහි කිසිවක් සංස්කරණය කළ නොහැක.',
  'bills.deductionsTotal': 'මුළු අඩු කිරීම්',
  'bills.deduction.transportCharges': 'ප්‍රවාහන ගාස්තු',
  'bills.deduction.tea': 'නිකුත් කළ තේ',
  'bills.deduction.savings': 'ඉතුරුම්',
  'bills.deduction.loansAdvance': 'ණය ආපසු ගෙවීම',
  'bills.deduction.advance': 'අත්තිකාරම්',
  'bills.deduction.manure': 'පොහොර',
  'bills.deduction.otherCards': 'වෙනත් කාඩ්පත්',
  'bills.deduction.stamps': 'මුද්දර',
  'bills.deduction.previousDebts': 'පෙර ණය',
  'bills.unbalancedWarning':
    'මෙම බිල්පතේ අඩු කිරීමේ පේළි එහි සඳහන් එකතුවට නොගැළපේ (BR-107). මෙම මාසය ප්‍රකාශයට පත් නොකරන්න — කර්මාන්තශාලා පරිපාලකට දන්වන්න.',

  'bills.balance': 'ශේෂය',
  'bills.balanceDescription': 'කර්මාන්තශාලාව ගෙවන්නේ පූර්ණ රුපියල්. කාසි ඊළඟ මාසයට ගෙන යයි.',
  'bills.balanceAmount': 'ශේෂ මුදල',
  'bills.coinsBroughtForward': 'පෙරට ගෙන ආ කාසි',
  'bills.savingsWithdrawal': 'ආපසු ගත් ඉතුරුම්',
  'bills.coinsCarriedForward': 'ඉදිරියට ගෙන යන කාසි',
  'bills.finalBalance': 'අවසාන ශේෂය',
  'bills.carriesDebtNotice':
    'අඩු කිරීම් මේ මාසයේ ගිණුමට වඩා වැඩි විය. ගෙවිය යුතු කිසිවක් නැත, තවද {{amount}} ඊළඟ මාසයට ගෙන යයි.',
  'bills.noBankNotice':
    'මෙම සැපයුම්කරුට මුදල් ගෙවිය යුතු නමුත් ලිපිගොනුවේ බැංකු විස්තර නැත. ගෙවීම් වටයක් එම පේළිය රඳවා තබයි.',

  'bills.carryForward': 'ඊළඟ මාසයට ගෙන ගියා',
  'bills.nextMonthDeb': 'ඉදිරියට ගෙන ගිය ණය',
  'bills.advanceBalance': 'අත්තිකාරම් ශේෂය',
  'bills.manureBalance': 'පොහොර ශේෂය',
  'bills.loanInterest': 'ණය පොලිය',

  'bills.savingsDescription':
    'සැපයුම්කරුගේ අනුමත අනුපාතයෙන් අඩු කර කර්මාන්තශාලාව විසින් රඳවා ගනී.',
  'bills.savingsThisMonth': 'මේ මාසය',
  'bills.savingsPrevious': 'පෙර ශේෂය',
  'bills.savingsToDate': 'මේ දක්වා ශේෂය',
  'bills.openPassbook': 'ඉතුරුම් පොත විවෘත කරන්න',

  'bills.dailySupply': 'දෛනික සැපයුම',
  'bills.dailySupplyDetail': 'දින {{days}}ක දළු, මුළු {{kgs}}.',

  'bills.correctionsDraft':
    'මාසය ප්‍රකාශයට පත් කරන තුරු මෙහි කිසිවක් සැපයුම්කරුට නොයවයි. එතෙක්, වැරදි අගයක් එහි මූලාශ්‍රයේ නිවැරදි කරන්න — දළු එකතු කිරීමේ දළු භාරයක්, නැතහොත් මිල සහ මාසය අවසන් කිරීමේ මිල — ඉන්පසු නැවත සාදන්න.',
  'bills.correctionsPublished':
    'මෙම බිල්පත ප්‍රකාශයට පත් කර ඇති බැවින් එය වාර්තාවයි. ප්‍රකාශයට පත් කළ බිල්පතක් නිවැරදි කළ හැකිද, නැතහොත් වැරැද්දක් සැමවිටම ඊළඟ ගිණුමේ සකස් කරන්නේද යන්න කර්මාන්තශාලාව සමඟ තවම විසඳා නැති ප්‍රශ්නයකි (§21.8).',

  /* ───────────────────────────── M6 Payouts ───────────────────────────── */
  'payouts.title': 'ගෙවීම්',
  'payouts.subtitle': 'ප්‍රකාශයට පත් කළ මාසයක් ගෙවීම, එක් ක්‍රමයක් පසු එකක්',
  'payouts.monthTotal': 'ගෙවිය යුතු',
  'payouts.monthPaid': 'ගෙවා ඇත',
  'payouts.empty': 'මෙම මාසය සඳහා ගෙවීම් වට නැත',
  'payouts.emptyHint': 'මාසය ප්‍රකාශයට පත් කළ පසු එකක් සූදානම් කරන්න.',

  'payouts.column.method': 'ක්‍රමය',
  'payouts.column.total': 'එකතුව',
  'payouts.column.progress': 'ගෙවා ඇත',
  'payouts.column.prepared': 'සූදානම් කළේ',
  'payouts.column.released': 'නිකුත් කළේ',
  'payouts.column.supplier': 'සැපයුම්කරු',
  'payouts.column.amount': 'මුදල',
  'payouts.column.account': 'ගිණුම',
  'payouts.progress': '{{total}}ක් අතරින් {{paid}}',
  'payouts.awaitingApproval': 'කළමනාකරුවෙකු බලාපොරොත්තුවෙන්',
  'payouts.status.draft': 'කෙටුම්පත',
  'payouts.status.approved': 'නිකුත් කළා',
  'payouts.status.completed': 'සම්පූර්ණයි',
  'payouts.heldCount': '{{count}}ක් රඳවා ඇත',
  'payouts.failedCount': '{{count}}ක් අසාර්ථක',

  'payouts.prepareTitle': 'වටයක් සූදානම් කරන්න',
  'payouts.prepareDescription':
    'එක් ගෙවීම් ක්‍රමයකට එක් වටයක්: බැංකු ලිපිගොනුවක්, චෙක්පත් ලැයිස්තුවක් සහ මුදල් පත්‍රිකාවක් යනු වෙනස් කාර්යයන් තුනකි.',
  'payouts.method': 'ගෙවීම් ක්‍රමය',
  'payouts.prepare': 'වටය සූදානම් කරන්න',
  'payouts.prepareHint':
    'මෙම ක්‍රමයේ මුදල් ගෙවිය යුතු සෑම සැපයුම්කරුවෙකු සඳහා පේළියක් සාදයි. කළමනාකරුවෙක් නිකුත් කරන තුරු කිසිවක් නොගෙවයි.',
  'payouts.prepareReadOnly': 'ගෙවීම් වටයක් සූදානම් කරන්නේ ගණකාධිකාරී පමණි.',
  'payouts.prepared': '{{method}} වටය සූදානම් කළා',
  'payouts.preparedDetail': '{{lines}}ක් ගෙවිය යුතුයි, {{held}}ක් රඳවා ඇත.',
  'payouts.prepareFailed': 'වටය සූදානම් වූයේ නැත',
  'payouts.notPublished':
    '{{month}} තවම ප්‍රකාශයට පත් කර නැත. ගෙවීම් වටයකට අවසන් කළ මාසයක් අවශ්‍යයි — එතෙක් අගයන් තවමත් වෙනස් විය හැකි අතර, කර්මාන්තශාලාවෙන් පිටව ගිය මුදල් නැවත ලබා ගත නොහැක.',
  'payouts.noBills':
    '{{month}} සඳහා බිල්පත් සාදා නැත, එබැවින් ගෙවීමට පදනමක් නැත.',
  'payouts.allMethodsPrepared': 'මෙම මාසය සඳහා සෑම ගෙවීම් ක්‍රමයකටම දැනටමත් වටයක් ඇත.',
  'payouts.noFileExport':
    'වටයක් නිකුත් කළ පසු ඔබට එය ගොනුවක් ලෙස බාගත හැක, වින්‍යාසය → ගෙවීම් ගොනුව හි සඳහන් පිරිසැලසුමට අනුව. තවමත් විවෘතව ඇත්තේ (§21.17) පාලන එකතු සහිත ස්ථිර-පළල බැංකු ආකෘතියක් සහ කලින් මුද්‍රිත චෙක්පත් මත මුද්‍රණය කිරීමයි — දෙකටම ඔබේ බැංකුවේම පිරිවිතර අවශ්‍යයි.',

  'payouts.downloadFile': 'ගොනුව බාගන්න',
  'payouts.fileHint':
    'මෙම වටයේ පැතුරුම්පතක්, වින්‍යාසය → ගෙවීම් ගොනුව හි සඳහන් පිරිසැලසුමට අනුව. පාලන එකතු සහිත ස්ථිර-පළල බැංකු ගොනුවක් තවම නොවේ, චෙක්පත් මුද්‍රණයද නොවේ — ඒවාට තවමත් ඔබේ බැංකුවේම පිරිවිතර අවශ්‍යයි (§21.17).',
  'payouts.fileDownloaded': 'ගොනුව බාගත කළා',
  'payouts.fileDownloadedHint':
    'එහි සම්පූර්ණ ගිණුම් අංක ඇත, එබැවින් මෙම බාගැනීම ඔබේ නමට එරෙහිව විගණන ලොගයේ සටහන් වේ.',
  'payouts.fileFailed': 'ගොනුව සාදන ලද්දේ නැත',

  'payouts.runTitle': '{{method}} · {{month}}',
  'payouts.runSubtitle': 'ගෙවිය යුතු පේළි {{lines}}ක්, මුළු {{total}}',
  'payouts.backToMonth': '{{month}} වෙත ආපසු',
  'payouts.releaseTitle': 'නිකුත් කිරීම',
  'payouts.releaseDescription':
    'මෙම වටයේ කිසිවක් ගෙවා නැත. එය නිකුත් කරන්නේ කළමනාකරුවෙකි, තවද එය සූදානම් කළ පුද්ගලයා විය නොහැක.',
  'payouts.releasedDescription':
    'මෙම වටය නිකුත් කර ඇත. බැංකුව කළ දේ පේළියෙන් පේළියට වාර්තා කරන්න.',
  'payouts.stat.payable': 'ගෙවිය යුතු',
  'payouts.stat.paid': 'ගෙවා ඇත',
  'payouts.stat.failed': 'අසාර්ථක',
  'payouts.stat.held': 'රඳවා ඇත',
  'payouts.heldExplanation':
    'පේළි {{count}}ක් රඳවා ඇත: සැපයුම්කරුට මුදල් ගෙවිය යුතු නමුත් එය ගෙවීමට ගිණුමක් නැත. ගිණුම් පොත ලැබෙන තුරු ඒවා මෙම වටයේ රැඳී සිටින අතර කිසිවකට එරෙහිව නොගණන් — ඒවා නොමැතිව වටය තවමත් සම්පූර්ණ කළ හැක.',
  'payouts.preparedBy': '{{name}} විසින් {{when}} සූදානම් කළා',
  'payouts.releasedBy': '{{name}} විසින් {{when}} නිකුත් කළා',
  'payouts.release': '{{total}} නිකුත් කරන්න',
  'payouts.releaseHint': 'නිකුත් කිරීමෙන් මුදල් ගෙවීම සඳහා යවා ඇති බව සටහන් වේ.',
  'payouts.releaseNeedsManager': 'ගෙවීම් වටයක් නිකුත් කිරීම කළමනාකරුගේ තීරණයකි.',
  'payouts.fourEyesHint': 'ඔබ මෙම වටය සූදානම් කළ බැවින්, එය නිකුත් කළ යුත්තේ වෙනත් අයෙකි (BR-501).',
  'payouts.nothingPayableHint': 'මෙම වටයේ සෑම පේළියක්ම රඳවා ඇත. නිකුත් කිරීමට කිසිවක් නැත.',
  'payouts.approvedNotice': 'නිකුත් කළා. බැංකුව පිළිතුරු දෙන පරිදි එක් එක් පේළිය සලකුණු කරන්න.',
  'payouts.completedNotice': 'සෑම පේළියක්ම විසඳා ඇත, {{when}}.',
  'payouts.confirmReleaseTitle': 'මෙම වටය නිකුත් කරන්නද?',
  'payouts.confirmReleaseBody':
    'මෙයින් කර්මාන්තශාලාව මෙම ගෙවීම් යවා ඇති බව සටහන් වේ. ඔබ බැංකුවට දීමට යන දේට එරෙහිව එකතුව පරීක්ෂා කරන්න.',
  'payouts.confirmRelease': 'වටය නිකුත් කරන්න',
  'payouts.releaseNoteHint': 'අත්‍යවශ්‍ය නොවේ. මෙම වටය ගැන කාර්යාලය දැනගත යුතු කිසිවක්.',
  'payouts.approved': 'වටය නිකුත් කළා — {{total}}',
  'payouts.approveFailed': 'වටය නිකුත් වූයේ නැත',

  'payouts.linesTitle': 'පේළි',
  'payouts.linesDescription': 'රඳවා ඇති සහ නොගෙවූ ඒවා පළමුව — තවම කළ යුත්තේ ඒවාය.',
  'payouts.filterLines': 'කුමන පේළිද',
  'payouts.filter.all': 'සියලුම පේළි',
  'payouts.filter.held': 'රඳවා ඇති ({{count}})',
  'payouts.filter.pending': 'තවම ගෙවා නැති',
  'payouts.filter.failed': 'අසාර්ථක',
  'payouts.filter.paid': 'ගෙවූ',
  'payouts.noLinesHint': 'එම පෙරහනට ගැළපෙන පේළි නැත.',
  'payouts.line.pending': 'තවම ගෙවා නැත',
  'payouts.line.held': 'රඳවා ඇත',
  'payouts.line.paid': 'ගෙවා ඇත',
  'payouts.line.failed': 'අසාර්ථක',

  'payouts.markPaid': 'ගෙවා ඇත',
  'payouts.markFailedShort': 'අසාර්ථක',
  'payouts.markPaidTitle': 'මෙම ගෙවීම වාර්තා කරන්න',
  'payouts.markPaidBody': 'මුදල් සැබවින්ම ගිණුමෙන් පිටව ගිය පසු පමණක් පේළියක් ගෙවූ බව සලකුණු කරන්න.',
  'payouts.markFailedTitle': 'අසාර්ථක ගෙවීමක් වාර්තා කරන්න',
  'payouts.markFailedBody':
    'සැපයුම්කරුට ගෙවා නැත. සිදු වූ දේ ලියන්න — මෙම වටය ඊළඟට භාරගන්නා අය ඔබේ සටහන අනුව කටයුතු කරයි.',
  'payouts.reasonLabel': 'වැරදුණේ කුමක්ද',
  'payouts.reasonHint': 'අවම අකුරු {{min}}ක්, උදා: බැංකුව ආපසු දුන් හේතුව.',
  'payouts.confirmPaid': 'ගෙවූ බව සලකුණු කරන්න',
  'payouts.confirmFailed': 'අසාර්ථක බව සලකුණු කරන්න',
  'payouts.markedPaid': '{{code}} ගෙවූ බව සලකුණු කළා',
  'payouts.markedFailed': '{{code}} අසාර්ථක බව සලකුණු කළා',
  'payouts.markFailed': 'පේළිය යාවත්කාලීන වූයේ නැත',

  /* ───────────────────────────── M8 Savings ───────────────────────────── */
  'savings.title': 'ඉතුරුම්',
  'savings.subtitle': 'සැපයුම්කරුවන් වෙනුවෙන් කර්මාන්තශාලාව රඳවා ගෙන ඇති මුදල්',
  'savings.balanceTotal': 'සැපයුම්කරුවන් වෙනුවෙන් රඳවා ඇත',
  'savings.contributedThisMonth': '{{month}} හි එකතු කළා',
  'savings.schemeTitle': 'යෝජනා ක්‍රමය',
  'savings.schemeDescription':
    'සැපයුම්කරු කිලෝවකට අනුපාතයක් තෝරයි, එය ඔවුන්ගේ මාසික ගිණුමෙන් අඩු කරයි, තවද කර්මාන්තශාලාව එය රඳවා ගනී.',
  'savings.stat.accounts': 'ගිණුම්',
  'savings.stat.optedOut': 'ඉවත් වී ඇත',
  'savings.stat.contributing': 'මේ මාසයේ දායක වුණා',
  'savings.stat.averagePerKg': 'කිලෝවකට සාමාන්‍යය',
  'savings.trendTitle': 'මාසය අනුව ඉතුරුම්',
  'savings.column.month': 'මාසය',
  'savings.column.contributed': 'එකතු කළා (රු.)',
  'savings.column.heldAfter': 'ඉන්පසු රඳවා ඇති (රු.)',
  'savings.column.rate': 'අනුපාතය /කිලෝ',
  'savings.column.balance': 'ශේෂය (රු.)',
  'savings.column.lastContribution': 'අවසන් වර එකතු කළා',
  'savings.column.source': 'මූලාශ්‍රය',
  'savings.column.amount': 'මුදල (රු.)',
  'savings.liabilityNote':
    'මෙය සැපයුම්කරුවන්ගේ මුදල්, කර්මාන්තශාලාවේ ආදායම නොවේ. දායකත්වයක් නිර්මාණය වන්නේ මාසයක් ප්‍රකාශයට පත් කිරීමෙන් — එය ප්‍රකාශයට පත් කළ බිල්පතක ඉතුරුම් පේළියයි — එබැවින් මෙහි එකතු කිරීමට හෝ සංස්කරණය කිරීමට කිසිවක් නැත.',

  'savings.accountsTitle': 'ඉතුරුම් ගිණුම්',
  'savings.searchPlaceholder': 'අංකය හෝ නම සොයන්න',
  'savings.filterLabel': 'පෙන්වන්න',
  'savings.filter.any': 'සියලුම ගිණුම්',
  'savings.filter.contributing': 'දායක වන',
  'savings.filter.optedOut': 'ඉවත් වූ',
  'savings.contributing': 'දායක වන',
  'savings.neverContributed': 'කිසිදා නැත',
  'savings.pendingRateChange': 'අනුපාත වෙනසක් විසඳා නැත',

  'savings.ledgerTitle': 'ඉතුරුම් පොත · {{code}} {{name}}',
  'savings.ledgerSubtitle': 'ශේෂය {{balance}} · කිලෝවකට {{rate}}',
  'savings.ledgerTable': 'ඉතුරුම් චලනයන්, පැරණිතම පළමුව',
  'savings.source.openingBalance': 'ආරම්භක ශේෂය',
  'savings.source.billDeduction': 'බිල්පතෙන් අඩු කිරීම',
  'savings.source.adjustment': 'සකස් කිරීම',
  'savings.source.withdrawal': 'ආපසු ගැනීම',
  'savings.source.interest': 'පොලිය',
  'savings.noLedger': 'මෙම ඉතුරුම් පොතේ තවම කිසිවක් නැත',
  'savings.noLedgerHint':
    'මෙම සැපයුම්කරුගේ බිල්පතේ ඉතුරුම් අඩු කිරීමක් සමඟ මාසයක් ප්‍රකාශයට පත් වූ විට චලනයක් මෙහි දිස් වේ.',
  'savings.withdrawalsTitle': 'ඉතුරුම් ආපසු ගැනීම',
  'savings.windowOpen': 'විවෘතයි — {{month}}',
  'savings.windowClosed': '{{month}} මාසයේ විවෘත වේ',
  'savings.windowClosedHint':
    'ඉතුරුම් ආපසු ගත හැක්කේ {{month}} මාසයේදීය. ඒ දක්වා කිසිවක් සටහන් කළ නොහැක.',
  'savings.availableAfterPending':
    'තවත් {{available}}ක් ඉල්ලා සිටිය හැක — {{pending}}ක් දැනටමත් ගෙවීම බලාපොරොත්තුවෙන් සිටී.',
  'savings.awaitingBill': 'ලබන ගිණුම බලාපොරොත්තුවෙන්',
  'savings.requestedBy': '{{name}} විසින් සටහන් කරන ලදී, {{when}}',
  'savings.cancelWithdrawal': 'මෙය අවලංගු කරන්න',
  'savings.cancelReasonHint': 'එය සකසා ඇති බව සැපයුම්කරුට කියා ඇත. අවම වශයෙන් අකුරු 10ක්.',
  'savings.cancelConfirm': 'ආපසු ගැනීම අවලංගු කරන්න',
  'savings.withdrawalCancelled': 'ආපසු ගැනීම අවලංගු කරන ලදී',
  'savings.withdrawalCancelFailed': 'කිසිවක් වෙනස් කළේ නැත',
  'savings.withdrawalReadOnly': 'ඉතුරුම් ආපසු ගත හැක්කේ ගණකාධිකාරීවරයාට පමණි.',
  'savings.nothingToWithdraw': 'මෙම සැපයුම්කරුට ආපසු ගැනීමට ඉතුරුම් නැත.',
  'savings.withdrawAmount': 'ආපසු ගන්නා මුදල',
  'savings.withdrawAmountHint': '{{available}} දක්වා.',
  'savings.withdrawReasonHint': 'අවම වශයෙන් අකුරු {{min}}ක්. මාස කිහිපයකට පසු සැපයුම්කරු ඇයි දැයි අසයි.',
  'savings.recordWithdrawal': 'ආපසු ගැනීම සටහන් කරන්න',
  'savings.paidOnNextBill':
    'තවම කිසිවක් සිදු නොවේ. එය සැපයුම්කරුගේ ලබන දළු ගිණුමෙන් ගෙවේ, සහ එම ගිණුම ප්‍රකාශයට පත් කළ විට ඉතුරුම් පොත වෙනස් වේ.',
  'savings.withdrawalRecorded': '{{amount}} ලබන ගිණුමෙන් ගෙවනු ලැබේ',
  'savings.withdrawalRecordedHint':
    'ශේෂය තවම වෙනස් වී නැත — මෙය ගෙවන ගිණුම ප්‍රකාශයට පත් කළ විට එය වෙනස් වේ.',
  'savings.withdrawalFailed': 'කිසිවක් සටහන් කළේ නැත',
  'savings.paidOn': '{{month}} ගිණුමෙන් ගෙවා ඇත',
  'savings.wasCancelled': 'අවලංගු කරන ලදී',
  'savings.interestNote':
    'මෙම කර්මාන්තශාලාව වසරකට {{rate}}%ක් සටහන් කරයි. කොන්සෝලය එය ගණනය නොකරයි — ගණකාධිකාරී එය ඇතුළත් කරයි (§21.9).',
  'savings.problem.not-positive': 'බිංදුවට වඩා වැඩි මුදලක් ඇතුළත් කරන්න.',
  'savings.problem.exceeds-available': 'මෙම සැපයුම්කරුට ආපසු ගැනීමට ඉතිරිව ඇති ප්‍රමාණයට වඩා එය වැඩිය.',
  'savings.problem.window-closed': 'මෙම මාසයේ ඉතුරුම් ආපසු ගත නොහැක.',
  'savings.problem.no-balance': 'ආපසු ගැනීමට ඉතුරුම් නැත.',

  /* ─────────── M11 News · M12 Static content (shared) ─────────── */
  /* AC-08 lives in this block: a missing translation must be visible to the editor,
     and every string below exists to say *what the gap costs* rather than that one
     exists. "Sinhala missing" is a fact; "a Sinhala supplier is reading English right
     now" is the thing that gets it fixed. */
  'content.languages': 'භාෂා',
  'content.language.si': 'සිංහල',
  'content.language.en': 'ඉංග්‍රීසි',
  'content.language.ta': 'දෙමළ',
  'content.fallbackLanguageHint': 'සියල්ල ආපසු යොමු වන භාෂාව. එය හිස්ව තැබිය නොහැක.',
  'content.state.missing': '— තවම ලියා නැත',
  'content.state.stale': '— ඉංග්‍රීසි පිටපතට වඩා පැරණි',

  'content.copyTitle': 'පිටපත',
  'content.copyDescription':
    'එක් වර එක් භාෂාවක්. එක් භාෂාවක් සුරැකීමෙන් අනෙක් ඒවාට බලපෑමක් නැත.',
  'content.field.title': 'මාතෘකාව',
  'content.field.titleHint': 'ලැයිස්තුවේ සැපයුම්කරු දකින දේ.',
  'content.field.excerpt': 'සාරාංශය',
  'content.field.excerptHint': 'එක් පේළියක්, පෝෂණයේ මාතෘකාව යටතේ පෙන්වයි. අත්‍යවශ්‍ය නොවේ.',
  'content.field.body': 'අන්තර්ගතය',
  'content.field.bodyHint': 'සරල පෙළ. පේළි බිඳීම් රැඳේ.',
  'content.translateFrom': '{{language}} භාෂාවෙන් පරිවර්තනය කරමින්',
  'content.save': '{{language}} සුරකින්න',
  'content.saved': '{{language}} සුරැක්කා',
  'content.saveFailed': 'එම පිටපත සුරැකුණේ නැත',
  'content.saveNeedsCopy': 'මෙය සුරැකීමට පෙර මාතෘකාවක් සහ අන්තර්ගතයක් අවශ්‍යයි.',
  'content.unsaved': 'සුරැකී නැති වෙනස්කම්. භාෂාව මාරු කිරීමෙන් ඒවා නැති වේ.',
  'content.savedAt': '{{name}} විසින් {{when}} සුරැක්කා.',
  'content.notWrittenYet': 'මෙම භාෂාවෙන් තවම කිසිවක් ලියා නැත.',
  'content.readOnly': 'අන්තර්ගතය වෙනස් කළ හැක්කේ සංස්කාරකයෙකුට පමණි.',
  'content.lastEditedBy': 'අවසන් වර සංස්කරණය කළේ {{name}}, {{when}}',
  'content.auditTitle': 'මෙම වාර්තාවේ වෙනස්කම්',

  'content.gap.complete': 'මෙම කර්මාන්තශාලාව ප්‍රකාශයට පත් කරන සෑම භාෂාවකින්ම ලියා ඇත.',
  'content.gap.fallbackMissing':
    '{{language}} පිටපතක් නැත, එබැවින් කිසිදු භාෂාවකින් සැපයුම්කරුවෙකුට පෙන්වීමට කිසිවක් නැත. එය ලියන තුරු මෙය ප්‍රකාශයට පත් කළ නොහැක.',
  'content.gap.missingLive':
    '{{languages}} පිටපතක් නොමැතිව සක්‍රීයයි. එම භාෂාවලින් කියවන සැපයුම්කරුවන්ට මේ මොහොතේ පෙන්වන්නේ {{fallback}} අනුවාදයයි.',
  'content.gap.missingDraft': '{{languages}} වලින් තවම ලියා නැත.',
  'content.gap.stale':
    '{{languages}} පිටපත එය පරිවර්තනය කළ ඉංග්‍රීසියට වඩා පැරණියි. යෙදුම එය දැනට වලංගු මෙන් පෙන්වයි, එබැවින් සැපයුම්කරුට කිසිවක් වැරදි ලෙස නොපෙනේ.',
  'content.badge.missing': '{{count}}ක් නැත',
  'content.badge.stale': '{{count}}ක් යාවත්කාලීන නැත',
  'content.badge.gaps': 'නිවැරදි කිරීමට {{count}}ක්',
  'content.column.languages': 'භාෂා',
  'content.column.lastEdit': 'අවසන් සංස්කරණය',
  'content.complete': 'සම්පූර්ණයි',
  'content.lens': 'පෙන්වන්න',

  'content.previewTitle': 'සැපයුම්කරු දකින දේ',
  'content.previewDescription':
    '{{language}} භාෂාවෙන් කියවන්නෙකු සඳහා, යෙදුම විසඳන ආකාරයටම විසඳා ඇත.',
  'content.previewFallback':
    '{{requested}} පිටපතක් නැත, එබැවින් {{requested}} කියවන්නෙකුට පෙන්වන්නේ {{fallback}} අනුවාදයයි.',
  'content.previewEmpty': 'පෙන්වීමට කිසිවක් නැත',
  'content.previewEmptyHint':
    'තවම කිසිදු භාෂාවකින් පිටපතක් නැත, එබැවින් යෙදුමට පෙන්වීමට කිසිවක් නොමැති වේ.',

  /* ───────────────────────────── M11 News ───────────────────────────── */
  'news.title': 'පුවත්',
  'news.subtitle': 'සැපයුම්කරුවන් යෙදුමේ කියවන පෝෂණය',
  'news.searchPlaceholder': 'ඕනෑම භාෂාවකින් මාතෘකා සහ පිටපත සොයන්න',
  'news.untitled': 'මාතෘකාවක් නැති ලිපිය',
  'news.backToList': 'පුවත් වෙත ආපසු',
  'news.column.title': 'ලිපිය',
  'news.column.published': 'ප්‍රකාශයට පත් කළ දිනය',
  'news.status.draft': 'කෙටුම්පත',
  'news.status.published': 'සක්‍රීය',
  'news.status.archived': 'සංරක්ෂිත',
  'news.lens.all': 'සියලුම ලිපි',
  'news.lens.incomplete': 'හිඩැසක් සමඟ සක්‍රීය',
  'news.empty': 'තවම ලිපි නැත',
  'news.emptyHint': 'මෙහි ප්‍රකාශයට පත් කරන ඕනෑම දෙයක් යෙදුමේ පුවත් පෝෂණයේ දිස් වේ.',
  'news.noIncomplete': 'සක්‍රීය කිසිවකට පරිවර්තනයක් අඩු නැත',
  'news.noIncompleteHint':
    'ප්‍රකාශයට පත් කළ සෑම ලිපියක්ම මෙම කර්මාන්තශාලාව ප්‍රකාශයට පත් කරන සෑම භාෂාවකින්ම ලියා ඇත.',

  'news.create': 'නව ලිපියක්',
  'news.createTitle': 'නව ලිපියක්',
  'news.createDescription':
    'පළමුව ඉංග්‍රීසි පිටපත ලියන්න — පරිවර්තනය කරන තුරු අනෙක් සෑම භාෂාවක්ම ආපසු යොමු වන්නේ එය වෙතය.',
  'news.createDraftHint':
    'එය කෙටුම්පතක් ලෙස සාදයි. ප්‍රකාශයට පත් කරන තුරු කිසිවක් සැපයුම්කරුවන්ට නොලැබේ.',
  'notifications.confirmSendBody': 'මෙම පණිවිඩය දුරකථන {{count}}කට වහාම යවනු ලැබේ.',
  'notifications.confirmSendHint': 'යැවූ පසු එය නැවත කැඳවිය නොහැක.',
  'staticContent.publishConfirmTitle': '{{page}} ප්‍රකාශයට පත් කරන්නද?',
  'staticContent.publishConfirmBody': 'මෙයින් පිටුව සැපයුම්කරුවන්ට වහාම සක්‍රීය වේ.',
  'news.createConfirm': 'කෙටුම්පත සාදන්න',
  'news.created': 'කෙටුම්පත සාදුවා',
  'news.createdHint': 'අනෙක් භාෂා එකතු කර, ඉන්පසු ප්‍රකාශයට පත් කරන්න.',
  'news.createFailed': 'ලිපිය සෑදුණේ නැත',

  'news.lifecycleTitle': 'ප්‍රකාශයට පත් කිරීම',
  'news.lifecycleDraft': 'මෙහි කිසිවක් තවම සැපයුම්කරුවෙකුට ලැබී නැත.',
  'news.lifecyclePublished': 'මෙය යෙදුමේ සක්‍රීයයි.',
  'news.publishedBy': '{{name}} විසින් {{when}} ප්‍රකාශයට පත් කළා.',
  'news.publish': 'ප්‍රකාශයට පත් කරන්න',
  'news.unpublish': 'ඉවත් කරන්න',
  'news.archive': 'සංරක්ෂණය කරන්න',
  'news.published': 'ප්‍රකාශයට පත් කළා — එය දැන් යෙදුමේ පෝෂණයේ ඇත',
  'news.unpublished': 'ඉවත් කළා. එය තවදුරටත් පෝෂණයේ නැත.',
  'news.archived': 'සංරක්ෂණය කළා',
  'news.publishFailed': 'ලිපිය ප්‍රකාශයට පත් වූයේ නැත',
  'news.unpublishFailed': 'ලිපිය ඉවත් වූයේ නැත',
  'news.archiveFailed': 'ලිපිය සංරක්ෂණය වූයේ නැත',
  'news.publishNeedsAdmin': 'ප්‍රකාශයට පත් කිරීම කර්මාන්තශාලා පරිපාලකගේ තීරණයකි.',
  'news.noDeleteHint':
    'ලිපි සංරක්ෂණය කරයි, කිසිදා මකා නොදමයි — සැපයුම්කරුවෙක් එකක් කියවා ඇති අතර ඒ ගැන විමසිය හැක.',
  'news.confirm.publishTitle': 'මෙම ලිපිය ප්‍රකාශයට පත් කරන්නද?',
  'news.confirm.publishBody': 'එය සෑම සැපයුම්කරුවෙකුගේ යෙදුමේ පෝෂණයේ වහාම දිස් වේ.',
  'news.confirm.publishAction': 'ප්‍රකාශයට පත් කරන්න',
  'news.confirm.publishWithGaps':
    'භාෂා නොමැතිව ප්‍රකාශයට පත් කළ හැක — යෙදුම ඉංග්‍රීසි වෙත ආපසු යොමු වේ — නමුත් පරිවර්තනය කරන තුරු එම සැපයුම්කරුවන් එය ඉංග්‍රීසියෙන් කියවනු ඇත.',
  'news.confirm.unpublishTitle': 'මෙය ඉවත් කරන්නද?',
  'news.confirm.unpublishBody':
    'එය පෝෂණයෙන් ඉවත් වේ. දැනටමත් කියවූ සැපයුම්කරුවන්ට කියවූ දේ ඉතිරි වේ; පිටපත මකා නොදමයි.',
  'news.confirm.unpublishAction': 'ඉවත් කරන්න',
  'news.confirm.archiveTitle': 'මෙම ලිපිය සංරක්ෂණය කරන්නද?',
  'news.confirm.archiveBody':
    'එය පෝෂණයෙන් සහ වැඩ කරන ලැයිස්තුවෙන් ඉවත් වී වාර්තාවේ රැඳේ. කිසිවක් මකා නොදමයි.',
  'news.confirm.archiveAction': 'සංරක්ෂණය කරන්න',

  /* ───────────────────── M12 Static content ───────────────────── */
  'staticContent.title': 'ස්ථිර පිටු',
  'staticContent.subtitle': 'යෙදුමේ ස්ථිර පිටු',
  'staticContent.pagesTitle': 'පිටු',
  'staticContent.page.faq': 'නිතර අසන ප්‍රශ්න',
  'staticContent.page.savingsScheme': 'ඉතුරුම් යෝජනා ක්‍රමය',
  'staticContent.page.creditTerms': 'ණය කොන්දේසි',
  'staticContent.page.about': 'කර්මාන්තශාලාව ගැන',
  'staticContent.page.terms': 'සැපයුම් කොන්දේසි',
  'staticContent.page.privacy': 'පෞද්ගලිකත්වය',
  'staticContent.status.draft': 'ප්‍රකාශයට පත් කර නැත',
  'staticContent.status.published': 'සක්‍රීය',
  'staticContent.notWritten': 'කිසිදා ලියා නැත',
  'staticContent.draftDescription':
    'මෙම පිටුව කිසිදා ප්‍රකාශයට පත් කර නැත, එබැවින් යෙදුම එහිම ඇතුළත් අනුවාදය පෙන්වයි.',
  'staticContent.liveDescription': '{{name}} විසින් ප්‍රකාශයට පත් කර, {{when}} සිට සක්‍රීයයි.',
  'staticContent.publish': 'මෙම පිටුව ප්‍රකාශයට පත් කරන්න',
  'staticContent.publishHint':
    'මෙයින් පසු, සංස්කරණයක් සුරැකීමෙන් එය වහාම සැපයුම්කරුවන් ඉදිරියේ තබයි — දෙවන පියවරක් නැත.',
  'staticContent.publishNeedsCopy': 'පළමුව {{language}} පිටපත ලියන්න.',
  'staticContent.publishNeedsAdmin': 'ප්‍රකාශයට පත් කිරීම කර්මාන්තශාලා පරිපාලකගේ තීරණයකි.',
  'staticContent.published': '{{page}} සක්‍රීයයි',
  'staticContent.publishFailed': 'පිටුව ප්‍රකාශයට පත් වූයේ නැත',
  'staticContent.editsAreLive':
    'මෙම පිටුව සක්‍රීයයි. සංස්කරණයක් සුරැකූ විගස එය සැපයුම්කරුවන්ට ලැබේ — සෑම වෙනසක්ම පෙර වචන සමඟ විගණන ලොගයේ සටහන් වේ.',
  'staticContent.savedLive': 'සැපයුම්කරුවන් දැන් මෙය දකියි.',

  /* ───────────────────────── M13 Notifications ───────────────────────── */
  /* §21.24 is unanswered — whether the office composes every send or whether
     bill-published fires off the publish step. The console does both and makes the
     choice a toggle, so the copy here has to explain a *mechanism* rather than assert
     a policy. */
  'notifications.title': 'දැනුම්දීම්',
  'notifications.subtitle':
    'සැපයුම්කරුවන්ට දැනුම් දී ඇති දේ, සහ කර්මාන්තශාලාව ස්වයංක්‍රීයව ඔවුන්ට දැනුම් දෙන දේ',
  'notifications.compose': 'දැනුම්දීමක් ලියන්න',

  'notifications.category.billPublished': 'ගිණුම ප්‍රකාශයට පත් කළා',
  'notifications.category.requestDecided': 'ඉල්ලීම තීරණය කළා',
  'notifications.category.newsArticle': 'පුවත් ලිපිය',
  'notifications.category.inquiryReplied': 'පණිවිඩයට පිළිතුරු දුන්නා',
  'notifications.event.billPublished':
    'මිල සහ මාසය අවසන් කිරීම යටතේ මාසයක් ප්‍රකාශයට පත් කළ විට ක්‍රියාත්මක වේ.',
  'notifications.event.requestDecided':
    'වෙනස් කිරීමේ ඉල්ලීමක් අනුමත හෝ ප්‍රතික්ෂේප කළ විට ක්‍රියාත්මක වේ.',
  'notifications.event.newsArticle': 'පුවත් ලිපියක් ප්‍රකාශයට පත් කළ විට ක්‍රියාත්මක වේ.',
  'notifications.event.inquiryReplied': 'කාර්යාලය පණිවිඩයකට පිළිතුරු දුන් විට ක්‍රියාත්මක වේ.',

  'notifications.triggersTitle': 'ස්වයංක්‍රීය දැනුම්දීම්',
  'notifications.triggersDescription':
    'යමක් සිදු වූ විට, කිසිවෙකු කිසිවක් ඔබන්නේ නැතිව පද්ධතිය විසින් යවනු ලැබේ.',
  'notifications.on': 'ක්‍රියාත්මක',
  'notifications.off': 'අක්‍රීය',
  'notifications.notConfigured': 'මෙම කර්මාන්තශාලාව සඳහා සකසා නැත',
  'notifications.triggerChanged': '{{name}} විසින් {{when}} වෙනස් කරන ලදී.',
  'notifications.triggerOn': '{{category}} දැන් ස්වයංක්‍රීයව යවනු ලැබේ',
  'notifications.triggerOff': '{{category}} තවදුරටත් ස්වයංක්‍රීයව නොයවනු ලැබේ',
  'notifications.triggerFailed': 'එම සැකසුම වෙනස් වූයේ නැත',
  'notifications.triggersNeedAdmin':
    'ස්වයංක්‍රීයව යවන දේ වෙනස් කළ හැක්කේ කර්මාන්තශාලා පරිපාලකට පමණි.',
  'notifications.openQuestion':
    'කාර්යාලය සෑම පණිවිඩයක්ම අතින් ලියනවාද, නැතහොත් පද්ධතිය ඒවා ස්වයංක්‍රීයව යවනවාද යන්න කර්මාන්තශාලාව සමඟ තවම විසඳා නැති ප්‍රශ්නයකි (§21.24). එය විසඳන තුරු දෙකම ක්‍රියා කරයි, තවද මෙම ස්විචයන් එයට පිළිතුරයි — එය තීරණය කිරීමට කේත වෙනසක් අවශ්‍ය නොවේ.',

  'notifications.column.message': 'පණිවිඩය',
  'notifications.column.category': 'වර්ගය',
  'notifications.column.audience': 'යැවූ පිරිස',
  'notifications.column.reach': 'ලැබුණු',
  'notifications.firedBy': 'ස්වයංක්‍රීයව යැව්වා',
  'notifications.composedBy': '{{name}} විසින් ලියන ලදී',
  'notifications.reachedDevices': 'දුරකථන {{count}}ක්',
  'notifications.optedOutDevices': '{{count}}ක් ඉවත් වී ඇත',
  'notifications.audience.allSuppliers': 'සෑම සැපයුම්කරුවෙක්ම',
  'notifications.audience.collectionPoint': '{{point}} පමණි',
  'notifications.audience.supplier': 'එක් සැපයුම්කරුවෙක්',
  'notifications.filterLabel': 'පෙන්වන්න',
  'notifications.filter.all': 'සියලුම දැනුම්දීම්',
  'notifications.filter.automatic': 'ස්වයංක්‍රීයව යැවූ',
  'notifications.filter.composed': 'කාර්යාලය ලියූ',
  'notifications.empty': 'තවම කිසිවක් යවා නැත',
  'notifications.emptyHint':
    'ස්වයංක්‍රීය දැනුම්දීම් ක්‍රියාත්මක වන විට මෙහි දිස් වේ, තවද කාර්යාලය ලියන ඕනෑම දෙයක් ඒවා සමඟම දිස් වේ.',
  'notifications.noDeliveryReports':
    'දුරකථනයක් කිසිදා ආපසු වාර්තා නොකරයි, එබැවින් මේවා යැවීමේ මොහොතේ අගයන් වේ — කිසිවෙකු එය කියවූ බවට සාක්ෂියක් නොවේ.',
  'notifications.useNewsHint':
    'දැනුම්දීමක් යනු ශීර්ෂ පාඨයකි, ලිපියක් නොවේ. ඊට වඩා දිගු දෙයක් අයත් වන්නේ',

  'notifications.composeTitle': 'දැනුම්දීමක් ලියන්න',
  'notifications.composeDescription':
    'ඔබ තෝරන පිරිසේ සෑම සැපයුම්කරුවෙකුගේම අගුළු තිරයේ මෙය දිස් වේ.',
  'notifications.field.category': 'වර්ගය',
  'notifications.field.categoryHint':
    'යෙදුම විවෘත කරන තිරය තීරණය කරයි. යෙදුම හඳුනා නොගන්නා දේ නොසලකා හරියි, එබැවින් මෙය හුදෙක් පෙනුම සඳහා නොවේ.',
  'notifications.field.categoryPlaceholder': 'වර්ගයක් තෝරන්න',
  'notifications.field.audience': 'යවන්නේ කාටද',
  'notifications.field.pickPoint': 'එකතු කිරීමේ ස්ථානයක් තෝරන්න',
  'notifications.audienceKind.allSuppliers': 'සෑම සැපයුම්කරුවෙක්ම',
  'notifications.audienceKind.collectionPoint': 'එක් එකතු කිරීමේ ස්ථානයක්',
  'notifications.field.title': 'මාතෘකාව',
  'notifications.field.titleHint': 'උපරිම අකුරු {{max}}ක් — අගුළු තිරය ඉතිරිය කපා දමයි.',
  'notifications.field.body': 'පණිවිඩය',
  'notifications.field.bodyHint': 'උපරිම අකුරු {{max}}ක්. සම්පූර්ණ දේ මෙහි කියන්න.',
  'notifications.reachLoading': 'මෙය කාට ලැබෙනවාද යන්න ගණනය කරමින්…',
  'notifications.reachSummary': 'සැපයුම්කරුවන් {{suppliers}}ක් හරහා දුරකථන {{devices}}කට ලැබේ.',
  'notifications.reachSuppressed':
    'දුරකථන {{count}}ක “{{category}}” අක්‍රීය කර ඇති බැවින් ඒවාට මෙය නොලැබේ.',
  'notifications.reachNoDevice': 'මෙම පිරිසේ සැපයුම්කරුවන් {{count}}ක් කිසිදා යෙදුම ස්ථාපනය කර නැත.',
  'notifications.reachNobody':
    'මෙම පිරිසේ කිසිවෙකුට එය නොලැබේ. ඒ වෙනුවට එය දැන්වීම් පුවරුවේ තබන්න, නැතහොත් වෙනත් වර්ගයක් තෝරන්න.',
  'notifications.noRecallHint':
    'දැනුම්දීමක් ආපසු ගත නොහැක, තවද දුරකථනයක් එය පෙන්වූවාද යන්න කිසිවක් වාර්තා නොකරයි.',
  'notifications.send': 'යවන්න',
  'notifications.sendToCount': 'දුරකථන {{count}}කට යවන්න',
  'notifications.sent': 'දුරකථන {{count}}කට යැව්වා',
  'notifications.sentSuppressed':
    'දුරකථන {{count}}ක මෙම වර්ගය අක්‍රීය කර ඇති බැවින් ඒවාට එය නොලැබුණි.',
  'notifications.sendFailed': 'කිසිවක් යවා නැත',

  /* ───────────────────────── M14 Configuration ───────────────────────── */
  /* AC-12 lives in this block: "a new factory goes live without a code deploy". The copy
     has to explain *consequences*, because every edit here reaches across modules the
     reader cannot see from this screen. */
  'configuration.title': 'වින්‍යාසය',
  'configuration.subtitle': 'මෙම කර්මාන්තශාලාව ගැන කේතය නොව දත්ත වන සියල්ල',
  'config.tenantId': 'කර්මාන්තශාලා හැඳුනුම',
  /* Why the id is shown but greyed: it comes from the subdomain and every record in
     the factory is keyed on it, so the API refuses a patch that contains it
     (`tenant-immutable`). Without this the popover that exists to say so rendered
     its own key. */
  'config.tenantIdHint':
    'මෙය කර්මාන්තශාලාවේ වෙබ් ලිපිනයෙන් පැමිණේ, එබැවින් මෙතැනින් වෙනස් කළ නොහැක — සෑම වාර්තාවක්ම එය යටතේ ගොනු කර ඇත.',
  'config.readOnlyBadge': 'කියවීමට පමණි',
  'config.readOnly': 'වින්‍යාසය වෙනස් කළ හැක්කේ කර්මාන්තශාලා පරිපාලකට පමණි.',
  'config.sections': 'සැකසුම්',
  'config.save': 'මෙම කොටස සුරකින්න',
  'config.saved': 'වින්‍යාසය සුරැක්කා',
  'config.savedHint': 'වෙනස කොන්සෝලය පුරා සක්‍රීයයි — නැවත පූරණය කිරීම අවශ්‍ය නැත.',
  'config.saveFailed': 'කිසිවක් සුරැකුණේ නැත',
  'config.revert': 'වෙනස්කම් අස් කරන්න',
  'config.unsavedHint': 'මෙම කොටසේ සුරැකී නැති වෙනස්කම් ඇත.',
  'config.nothingToSave': 'කිසිවක් වෙනස් වී නැත.',
  'config.blockedHint': 'සුරැකීමට පෙර ඉහත ගැටලුව නිවැරදි කරන්න.',
  'config.remove': 'ඉවත් කරන්න',
  'config.inUse': '{{count}}ක් භාවිත කරයි',
  'config.listEmpty': 'තවම මෙහි කිසිවක් නැත.',
  'config.ac12Note':
    'කර්මාන්තශාලාවක් සකස් කිරීමේ මුළු කාර්යය මෙම තිරයයි. නව කර්මාන්තශාලාවකට අවශ්‍ය වන්නේ වෙබ් ලිපිනයක් සහ මෙම පිටුවේ සැකසුම් පමණි — කොන්සෝලයේ නව අනුවාදයක් නොවේ, සංවර්ධකයෙකුට කිරීමට කිසිවක් නැත.',

  'config.section.factory': 'කර්මාන්තශාලාව',
  'config.sectionHint.factory': 'නම, ලියාපදිංචිය, සම්බන්ධ වීම',
  'config.sectionDescription.factory':
    'මුද්‍රිත දළු ගිණුමේ සහ යෙදුමේ උපකාර තිරවල දිස් වන දේ.',
  'config.section.features': 'විශේෂාංග',
  'config.sectionHint.features': 'මෙම කර්මාන්තශාලාව ලබා දෙන දේ',
  'config.sectionDescription.features':
    'විශේෂාංගයක් අක්‍රීය කිරීමෙන් එය සම්පූර්ණයෙන් ඉවත් වේ — මෙනු පේළිය, තිර, සහ යෙදුම.',
  'config.section.operations': 'එකතු කිරීම සහ ගෙවීම',
  'config.sectionHint.operations':
    'ස්ථාන, බැංකු, පොහොර, ඉතුරුම්',
  'config.sectionDescription.operations':
    'කිරුම් ස්ථාන, ගෙවීම් වට, පොහොර ඉල්ලීම් සහ ඉතුරුම් යෝජනා ක්‍රමය තෝරා ගන්නා ලැයිස්තු.',
  'config.section.appearance': 'භාෂා සහ සන්නාමය',
  'config.sectionHint.appearance': 'භාෂා, ලාංඡනය, වර්ණ',
  'config.sectionDescription.appearance':
    'අන්තර්ගතය ලියන භාෂා මොනවාද, සහ කොන්සෝලය සහ යෙදුම පෙනෙන ආකාරය.',
  'config.section.push': 'දැනුම්දීම්',
  'config.sectionHint.push': 'යැවිය හැකි දේ',
  'config.sectionDescription.push':
    'මෙම කර්මාන්තශාලාවට යැවිය හැකි දැනුම්දීම් වර්ග මොනවාද, සහ නව දුරකථනයක් පිළිගන්නේ මොනවාද.',

  'config.factory.name': 'කර්මාන්තශාලාවේ නම',
  'config.factory.nameHint': 'සෑම ගිණුමකම සහ යෙදුමේ දිස් වේ.',
  'config.factory.regNo': 'ලියාපදිංචි අංකය',
  'config.factory.regNoHint': 'දළු ගිණුමේ මුද්‍රණය වේ.',
  'config.factory.telephone': 'දුරකථනය',
  'config.factory.location': 'ස්ථානය',
  'config.factory.supportEmail': 'කාර්යාලයේ විද්‍යුත් තැපෑල',
  'config.factory.supportHours': 'කාර්යාල වේලාවන්',
  'config.factory.legalFooter': 'නීතිමය පාද සටහන',
  'config.factory.legalFooterHint': 'මුද්‍රිත ගිණුමක පාදයේ ඇති කුඩා අකුරු.',

  'config.flagGates': '{{module}} කොන්සෝලයෙන් සහ යෙදුමෙන් ඉවත් කරයි.',
  'config.flagGatesApp': 'මෙය යෙදුමෙන් ඉවත් කරයි. කොන්සෝලයේ කිසිවක් මෙය මත රඳා නොපවතී.',
  'config.flag.enableSavings': 'ඉතුරුම් යෝජනා ක්‍රමය',
  'config.flag.enableAdvances': 'දළු මත අත්තිකාරම්',
  'config.flag.enableLoans': 'ආදායම් ඉතිහාසය මත ණය',
  'config.flag.enableManure': 'ණයට පොහොර',
  'config.flag.enableTeaPackets': 'ගබඩාවෙන් තේ පැකට්',
  'config.flag.enableInquiry': 'සැපයුම්කරුවන්ගේ පණිවිඩ',
  'config.flag.enableNews': 'පුවත් සංග්‍රහය',
  'config.flag.enablePushNotifications': 'දැනුම්දීම්',
  'config.flag.enablePromoBanner': 'ප්‍රවර්ධන බැනරය',
  'config.flag.enableOnboarding': 'හඳුන්වාදීමේ තිර',
  'config.flag.enableBiometricLogin': 'ඇඟිලි සලකුණු / මුහුණු පිවිසුම',
  'config.flag.enableDarkModeToggle': 'අඳුරු ආකාරය මාරුව',
  'config.flag.enableProfileTab': 'පැතිකඩ ටැබය',
  'config.flag.enableAutoLock': 'ස්වයංක්‍රීය අගුළු දැමීම',
  'config.flag.enablePayouts': 'ගෙවීම් වට',
  'config.flag.enableReports': 'වාර්තා',

  'config.points': 'එකතු කිරීමේ ස්ථාන',
  'config.addPoint': 'ස්ථානයක් එකතු කරන්න',
  'config.banks': 'බැංකු',
  'config.addBank': 'බැංකුවක් එකතු කරන්න',
  'config.branchesOf': '{{bank}} හි ශාඛා',
  'config.addBranch': 'ශාඛාවක් එකතු කරන්න',
  'config.withdrawalMonth': 'ඉතුරුම් ආපසු ගත හැකි මාසය',
  'config.withdrawalMonthHint': 'සෑම වසරකම මෙම මාසය තුළ සැපයුම්කරුවන්ට තම ඉතුරුම් ඉල්ලා සිටිය හැක.',
  'config.interestRate': 'ගෙවන පොලිය (වසරකට %)',
  'config.interestRateHint': 'කාර්යාලයට කිව හැකි වන පරිදි සටහන් කර ඇත. කිසිවක් නොගෙවන්නේ නම් 0 ලෙස තබන්න.',
  'config.interestNotApplied':
    'කොන්සෝලය පොලිය තනිවම ගණනය නොකරයි. එය ගෙවෙන්නේ අවසන් ශේෂය මතද, නැතහොත් වසරේ අවම ශේෂය මතද යන්න කිසිවෙකු පවසා නැත, සහ ඒ දෙක වෙනස් මුදල් ගෙවයි — එබැවින් කර්මාන්තශාලාව තීරණය කළ පසු, ගණකාධිකාරී එම මුදල ඉතුරුම් පොතට සටහනක් ලෙස ඇතුළත් කරයි (§21.9).',
  'config.manureProducts': 'සැපයුම්කරුවෙකුට ඉල්ලිය හැකි පොහොර',
  'config.manureProductsHint':
    'නම, මල්ලක කිලෝ ගණන, සහ එක් මල්ලක මිල. ඉල්ලීමක් මෙම ලැයිස්තුවෙන් මිල ගණන් කරයි — කාර්යාලය කිසිදා මුදලක් ටයිප් නොකරයි, එබැවින් සැපයුම්කරුට තමන්ගෙන් අය කළ දේ මෙයට එරෙහිව පරීක්ෂා කළ හැක.',
  'config.manure.name': 'පොහොර නම',
  'config.manure.packKg': 'මල්ලක කිලෝ',
  'config.manure.pricePerPack': 'මල්ලක මිල (රු.)',
  'config.manure.remove': '{{name}} ඉවත් කරන්න',
  'config.manure.example':
    'එක් මල්ලක් {{pack}}, මිල {{price}}. {{quantity}} ඉල්ලන සැපයුම්කරුවෙකුට මලු 2ක් ලබා දෙන අතර {{amount}} ගෙවිය යුතුය.',
  'config.manure.problem.no-name': 'පොහොරකට නමක් අවශ්‍යයි — යෙදුම එය ලැයිස්තුවේ පෙන්වයි.',
  'config.manure.problem.bad-pack': 'මල්ලක යමක් තිබිය යුතුය. කිලෝ බිංදුවක් මිල ගණන් කළ නොහැක.',
  'config.manure.problem.negative-price': 'මිලක් බිංදුවට වඩා අඩු විය නොහැක.',
  'config.manure.problem.duplicate-name': 'පොහොර දෙකක් එකම නමක් දරයි, එබැවින් ඉල්ලීමකට කුමන එකදැයි කිව නොහැක.',
  'config.addManureType': 'වර්ගයක් එක් කරන්න',
  'config.savingsRates': 'සැපයුම්කරුවෙකු තෝරා ගත හැකි ඉතුරුම් අනුපාත (කිලෝවකට රු.)',
  'config.addRate': 'අනුපාතයක් එකතු කරන්න',

  'rates.deduction.title': 'සෑම ගිණුමකින්ම අඩු වන දේ',
  'rates.deduction.description':
    'කර්මාන්තශාලාව නියම කරන ගාස්තු, සහ එක් මාසයකදී ණයකින් උපරිම වශයෙන් අඩු කළ හැකි ප්‍රමාණය. වෙනසකට දෙවන පුද්ගලයෙකු අවශ්‍යයි.',
  'rates.deduction.customised': 'මෙම කර්මාන්තශාලාව නියම කළා',
  'rates.deduction.shipped': 'කිසිදා නියම කර නැත',
  'rates.deduction.shippedHint':
    'මේවා කොන්සෝලය සමඟ පැමිණි අගයන් මිස මෙම කර්මාන්තශාලාවේ ඒවා නොවේ — කිලෝවකට රු. {{transport}} ප්‍රවාහනය ස්ථානගත අගයකි. කවුරුන් හෝ ඒවා නියම කරන තුරු, ඒවා සෑම ගිණුමකම ඇති අතර කිසිවෙකු ඒවා තෝරා නැත.',
  'rates.deduction.transportPerKg': 'ප්‍රවාහනය (කිලෝවකට රු.)',
  'rates.deduction.stamps': 'මුද්දර (රු.)',
  'rates.deduction.caps': 'එක් මාසයකදී ණයකින් අඩු කළ හැකි උපරිමය (%)',
  'rates.deduction.capsHint':
    'මාස කීයකින් ආපසු ගෙවනවාද යන්න සැපයුම්කරු තෝරයි. හොඳින් දළු නෙළන කාලයේ එකඟ වූ ආපසු ගෙවීමකට දුර්වල මාසයක් සම්පූර්ණයෙන් යාම නවත්වන සීමාව මෙයයි.',
  'rates.deduction.field.transportPerKg': 'කිලෝවකට ප්‍රවාහනය',
  'rates.deduction.field.stamps': 'මුද්දර',
  'rates.deduction.field.instalmentShares.advance': 'අත්තිකාරම් සීමාව',
  'rates.deduction.field.instalmentShares.loan': 'ණය සීමාව',
  'rates.deduction.field.instalmentShares.manure': 'පොහොර සීමාව',
  'rates.deduction.propose': 'අනුමැතියට යවන්න',
  'rates.deduction.reasonHint': 'අවම වශයෙන් අකුරු 10ක්. අනුමත කරන්නා තීරණය කිරීමට පෙර මෙය කියවයි.',
  'rates.deduction.needsApproval': 'මෙය ක්‍රියාත්මක වීමට පෙර දෙවන පුද්ගලයෙකු අනුමත කළ යුතුය.',
  'rates.deduction.nothingChanged': 'කිසිවක් වෙනස් වී නැත.',
  'rates.deduction.proposed': 'අනුමැතියට යවන ලදී',
  'rates.deduction.proposedHint': 'තවම කිසිවක් වෙනස් වී නැත. කළමනාකරුවෙකු එය අනුමත කළ යුතුය.',
  'rates.deduction.proposeFailed': 'කිසිවක් යවා නැත',
  'rates.deduction.pendingTitle': 'අනුමැතිය බලාපොරොත්තුවෙන් — {{name}} විසින් යෝජනා කරන ලදී, {{when}}',
  'rates.deduction.approve': 'අනුමත කරන්න',
  'rates.deduction.reject': 'ප්‍රතික්ෂේප කරන්න',
  'rates.deduction.approved': 'නව අනුපාත බලාත්මකයි',
  'rates.deduction.rejectd': 'වෙනස ප්‍රතික්ෂේප කරන ලදී',
  'rates.deduction.decideFailed': 'කිසිවක් වෙනස් කළේ නැත',
  'rates.deduction.noteHint': 'ප්‍රතික්ෂේප කිරීමට අවශ්‍යයි. යෝජනා කළ පුද්ගලයා එය කියවයි.',
  'rates.deduction.fourEyes': 'මෙය යෝජනා කළේ ඔබයි, එබැවින් වෙනත් අයෙකු එය අනුමත කළ යුතුය (BR-501).',
  'rates.deduction.awaitingManager': 'මෙය ක්‍රියාත්මක වීමට පෙර කළමනාකරුවෙකු අනුමත කළ යුතුය.',
  'rates.deduction.readOnly': 'මේවාට වෙනසක් යෝජනා කළ හැක්කේ ගණකාධිකාරීවරයාට පමණි.',
  'rates.deduction.elsewhere':
    'අනෙක් පේළි මෙහි නියම නොවේ. ඉතුරුම් සැපයුම්කරුගේය (වෙනස් කිරීමේ ඉල්ලීම්); තේ, පොහොර සහ අත්තිකාරම් යෙදුමෙන් ඉල්ලනු ලැබේ; පෙර ණය පසුගිය මාසයෙන් ගෙන එනු ලැබේ. අනුමත අනුපාත ලබන බිල් ජනනයට අදාළ වේ, දැනටමත් ප්‍රකාශයට පත් කළ මාසයකට කිසිදා නොවේ.',
  'config.contentLanguages': 'අන්තර්ගතය ලියන භාෂා',
  'config.contentLanguagesHint':
    'පුවත් ලිපි සහ යෙදුමේ ස්ථිර පිටු මේ සෑම භාෂාවකින්ම ලියනු ලැබේ. සලකුණු නොකළ භාෂාවක් නොමැති ලෙස ගණන් ගැනීම නවතී.',
  'config.fallbackRequired': '— අවශ්‍යයි',
  'config.recordsWritten': 'වාර්තා {{count}}ක් ලියා ඇත',
  'config.defaultLanguage': 'යෙදුමේ පෙරනිමි භාෂාව',
  'config.defaultLanguageHint': 'සැපයුම්කරුවෙකු එකක් තෝරා ගැනීමට පෙර දකින දේ.',
  'config.logoUrl': 'ලාංඡනයේ ලිපිනය',
  'config.logoUrlHint': 'වෙබ් ලිපිනයක්. හිස්ව තැබූ විට, ඇතුළත් කර ඇති තේ ලකුණ භාවිත වේ.',
  'config.faviconUrl': 'බ්‍රවුසර නිරූපකයේ ලිපිනය',
  'config.colour.primary': 'ප්‍රධාන වර්ණය',
  'config.colour.secondary': 'දෙවන වර්ණය',

  'config.topicPrefix': 'දැනුම්දීම් මාතෘකා පෙරයෙදුම',
  'config.topicPrefixHint': 'තාක්ෂණික. පණිවිඩ සැපයුම්කරු ඉල්ලා සිටියොත් පමණක් මෙය වෙනස් කරන්න.',
  'config.pushCategories': 'මෙම කර්මාන්තශාලාව යවන දැනුම්දීම් වර්ග',
  'config.pushCategoriesHint':
    'සලකුණු කළ වර්ගයක් පමණක් යැවිය හැක. දෙවන කොටුව යනු සැපයුම්කරු එය සක්‍රීය නොකර දුරකථනයක් එය පිළිගන්නේද යන්නයි.',
  'config.optedInByDefault': 'පෙරනිමියෙන් පිළිගනී',
  'config.pushFlagOff':
    'මෙම කර්මාන්තශාලාව සඳහා දැනුම්දීම් අක්‍රීය කර ඇති බැවින්, මෙහි කිසිවකට තවම බලපෑමක් නැත. පළමුව විශේෂාංග යටතේ ඒවා සක්‍රීය කරන්න.',

  /* The impact list. Each of these is why a change is refused or worth thinking about —
     rendered from the same `configImpact` the API refuses with, so the two can never
     name different things. */
  'config.impact.savingsHeld':
    'සැපයුම්කරුවන් {{count}}කට ඉතුරුම් යෝජනා ක්‍රමයේ මුදල් ඇත. එය අක්‍රීය කිරීමෙන් කර්මාන්තශාලාව ඔවුන් වෙනුවෙන් තබා ගෙන සිටින ශේෂයන් සැඟවෙනු ඇත, එබැවින් මෙය සුරැකිය නොහැක.',
  'config.impact.payoutRunsOpen':
    'ගෙවීම් වට {{count}}ක් අවසන් වී නැත. ගෙවීම් අක්‍රීය කිරීමෙන් තවම ගෙවා නැති මුදල් සැඟවෙනු ඇත, එබැවින් මෙය සුරැකිය නොහැක.',
  'config.impact.teaPacketsOutstanding':
    'රු. {{count}}ක තේ පැකට් නිකුත් කර ඇති නමුත් තවම ගිණුමකින් අය කර නැත. එය අක්‍රිය කිරීමෙන් එය සැඟවෙන නිසා, මෙය සුරැකිය නොහැක.',
  'config.impact.teaPacketPolicy.bad-pack':
    'පැකට්ටුවකට බරක් තිබිය යුතුය. සුරැකීමට පෙර පැකට් ප්‍රමාණය නියම කරන්න.',
  'config.impact.teaPacketPolicy.negative-price': 'පැකට්ටුවක මිල ශුන්‍යයට වඩා අඩු විය නොහැක.',
  'config.impact.teaPacketPolicy.bad-max':
    'එක් ඉල්ලීමකට සීමාව අවම වශයෙන් පැකට් එකක් විය යුතුය. යෝජනා ක්‍රමය වසා දැමීමට, ඒ වෙනුවට විශේෂාංගය අක්‍රිය කරන්න.',
  'config.impact.creditOutstanding':
    'සැපයුම්කරුවන් තවමත් {{facility}} සඳහා රු. {{amount}} ගෙවිය යුතුව ඇත. එය අක්‍රීය කිරීමෙන් එය සැඟවෙනු ඇත, එබැවින් මෙය සුරැකිය නොහැක.',
  'config.impact.surfaceRemoved':
    'සැමට වහාම මෙය මෙනුවෙන් අස් වේ, තවද යෙදුම එය ලබා දීම නවතී.',
  'config.impact.pointInUse':
    'බර කිරීම් {{count}}ක් {{point}} යටතේ ගොනු කර ඇත. එය ඉවත් කිරීමෙන් ඒවා තවදුරටත් නොපවතින ස්ථානයක් වෙත යොමු වනු ඇත, එබැවින් මෙය සුරැකිය නොහැක.',
  'config.impact.bankInUse':
    'සැපයුම්කරුවන් {{count}}කට {{bank}} හරහා ගෙවනු ලැබේ. ඔවුන්ගේ විස්තරවල නම එලෙසම පවතී; අලුත් ඒවා සඳහා එය ලබා දීම පමණක් නවතී.',
  'config.impact.languageDropped': '{{lang}} භාෂාවෙන් අන්තර්ගතයක් ලියා නැත, එබැවින් කිසිවක් අහිමි නොවේ.',
  'config.impact.languageDroppedWithCopy':
    'වාර්තා {{count}}ක් {{lang}} භාෂාවෙන් ලියා ඇත. පිටපත ඉතිරි වේ, නමුත් එය නොමැති ලෙස ගණන් ගැනීම නවතී — එබැවින් එය කල් ඉකුත් වී ඇති බව කිසිවක් ඔබට නොකියයි.',
  'config.section.teaPackets': 'තේ පැකට්',
  'config.sectionHint.teaPackets': 'පැකට්ටුවක් යනු කුමක්ද සහ එහි මිල',
  'config.sectionDescription.teaPackets':
    'ගබඩාව නිකුත් කරන පැකට්ටුව, එහි මිල, සහ එක් සැපයුම්කරුවෙකුට වරකට ඉල්ලිය හැකි උපරිමය. ඉල්ලීමක් අනුමත වන විට අය කරන්නේ මෙම මිලයි.',
  'config.teaPackets.packGrams': 'පැකට් ප්‍රමාණය (ග්‍රෑම්)',
  'config.teaPackets.pricePerPacket': 'පැකට්ටුවක මිල (රු.)',
  'config.teaPackets.maxPerRequest': 'එක් ඉල්ලීමකට උපරිම පැකට් ගණන',
  'config.teaPackets.maxHint':
    'මෙය තොග සීමාවකි, ණය සීමාවක් නොවේ. එය ඉක්මවූ ඉල්ලීමක් සීමාව පැහැදිලි කරන සටහනක් සමඟ ප්‍රතික්ෂේප කළ හැක.',
  'config.teaPackets.flagOff':
    'මෙම කර්මාන්තශාලාව සඳහා තේ පැකට් අක්‍රියයි, එබැවින් මෙහි කිසිවක් තවම බලපාන්නේ නැත. පළමුව "විශේෂාංග" යටතේ ඒවා සක්‍රිය කරන්න.',
  'config.section.payoutFile': 'ගෙවීම් ගොනුව',
  'config.sectionHint.payoutFile': 'ගෙවීම් වටයක් ලියා දමන ආකාරය',
  'config.sectionDescription.payoutFile':
    'ඔබ බැංකුවට උඩුගත කරන ගොනුවේ පිරිසැලසුම — කුමන තීරු, කුමන අනුපිළිවෙළින්, කුමන ශීර්ෂ සමඟද යන්න.',

  /* §21.17, වින්‍යාසය ලෙස. මෙම පිටපත කළ යුතු ප්‍රධානම දෙය: තීරු අච්චුවක් සකසා
     SLIPS ගොනුවක් සෑදුවා යැයි කිසිවෙකු විශ්වාස කිරීම වැළැක්වීමයි. */
  'config.payoutFile.scope':
    'ඔබේ බැංකුව ඉල්ලන පත්‍රිකාවට ගැළපෙන ලෙස මෙය සකසන්න. එය වෙන් කළ (delimited) ගොනුවක් ලියයි — බොහෝ බැංකුවල තොග-උඩුගත පත්‍රිකා එබඳුය. පාලන එකතු සහිත ස්ථිර-පළල ගොනුවක් හෝ කලින් මුද්‍රිත චෙක්පත් මත මුද්‍රණය කිරීම තවම කළ නොහැක; ඒවාට තවමත් බැංකුවේම පිරිවිතර අවශ්‍යයි (§21.17).',
  'config.payoutFile.preset': 'ආරම්භ කරන්නේ',
  'config.payoutFile.presetHint':
    'පසුව ඔබ සකසන ආරම්භක ලක්ෂ්‍යයක්. සම්පූර්ණ වන්නේ “සරල පැතුරුම්පත” පමණයි — අනෙක් දෙක එම ක්‍රමවලට සාමාන්‍යයෙන් අවශ්‍ය තීරු වන අතර, ශීර්ෂ ඔබේ බැංකුවේ පිරිවිතරයෙන් පුරවා ගැනීමට හිස්ව තබා ඇත.',
  'config.payoutFile.preset.genericCsv': 'සරල පැතුරුම්පත',
  'config.payoutFile.preset.slipsSkeleton': 'SLIPS (පුරවන්න)',
  'config.payoutFile.preset.ceftsSkeleton': 'CEFTS (පුරවන්න)',

  'config.payoutFile.delimiter': 'වෙන් කරන්නේ',
  'config.payoutFile.delimiter.comma': 'කොමාව  ,',
  'config.payoutFile.delimiter.semicolon': 'තිත්කොමාව  ;',
  'config.payoutFile.delimiter.pipe': 'සිරස් ඉරි  |',
  'config.payoutFile.delimiter.tab': 'ටැබ්',
  'config.payoutFile.headerRow': 'ශීර්ෂ පළමු පේළිය ලෙස ලියන්න',
  'config.payoutFile.amountFormat': 'මුදල් ලියන ආකාරය',
  'config.payoutFile.amountFormatHint':
    'මෙය ඔබේ බැංකුවේ පත්‍රිකාවට එරෙහිව පරීක්ෂා කරන්න. සත අපේක්ෂා කරන තැනකට රුපියල් යැවීමෙන් සෑම සැපයුම්කරුවෙකුටම ඔවුන්ට හිමි මුදලින් සියයෙන් එකක් ගෙවේ, සහ බැංකුව එය සතුටින් ක්‍රියාත්මක කරයි.',
  'config.payoutFile.amountFormat.decimal2': '4213.50  — රුපියල් සහ සත',
  'config.payoutFile.amountFormat.cents': '421350  — සත, දශම ලක්ෂ්‍යයක් නැත',
  'config.payoutFile.amountFormat.whole': '4214  — පූර්ණ රුපියල්',
  'config.payoutFile.accountFormat': 'ගිණුම් අංක ලියන ආකාරය',
  'config.payoutFile.accountFormat.plain': 'සටහන් කර ඇති ආකාරයටම',
  'config.payoutFile.accountFormat.digitsOnly': 'ඉලක්කම් පමණයි — ඉරි සහ හිස්තැන් ඉවත් කර',
  'config.payoutFile.reference': 'යොමුව',
  'config.payoutFile.referenceHint':
    'සැපයුම්කරු ඔවුන්ගේ බැංකු ප්‍රකාශනයේ දකින දේ. {{code}} ඔවුන්ගේ සැපයුම්කරු කේතය බවටත් {{month}} මාසය බවටත් පත් වේ.',

  'config.payoutFile.columns': 'තීරු, අනුපිළිවෙළින්',
  'config.payoutFile.columnsHint':
    'මෙහි අනුපිළිවෙළ ගොනුවේ අනුපිළිවෙළයි. ශීර්ෂය ඔබ ටයිප් කරන ආකාරයටම බැංකුව ගළපයි, එබැවින් එය පරිවර්තනය කරනවා වෙනුවට ඔවුන්ගේ පත්‍රිකාවෙන් පිටපත් කරන්න.',
  'config.payoutFile.headingFor': '{{field}} සඳහා ශීර්ෂය',
  'config.payoutFile.headingPlaceholder': 'බැංකුව ලියන ආකාරයට',
  'config.payoutFile.moveUp': 'ඉහළට ගෙනයන්න',
  'config.payoutFile.moveDown': 'පහළට ගෙනයන්න',
  'config.payoutFile.removeColumn': '{{field}} ඉවත් කරන්න',
  'config.payoutFile.bankOnly': '· චෙක්පත් සහ මුදල් වටවල හිස්ය',

  'config.payoutFile.field.supplierCode': 'සැපයුම්කරු කේතය',
  'config.payoutFile.field.supplierName': 'සැපයුම්කරුගේ නම',
  'config.payoutFile.field.accountNumber': 'ගිණුම් අංකය',
  'config.payoutFile.field.bankName': 'බැංකුව',
  'config.payoutFile.field.branchName': 'ශාඛාව',
  'config.payoutFile.field.amount': 'මුදල',
  'config.payoutFile.field.reference': 'යොමුව',
  'config.payoutFile.field.monthKey': 'මාසය',
  'config.payoutFile.field.method': 'ගෙවීම් ක්‍රමය',

  'config.payoutFile.preview': 'ගොනුව පෙනෙන ආකාරය',
  'config.payoutFile.previewHint':
    'ගොතන ලද සැපයුම්කරුවන් දෙදෙනෙක්, දෙවැන්නාට බැංකු විස්තර නැත — එවිට චෙක්පත් හෝ මුදල් පේළියක් එක් එක් තීරුවට කරන දේ ඔබට පෙනේ. සැබෑ ගොනුව ලියන එම කේතයෙන්ම ලියා ඇත.',
  'config.payoutFile.previewBlocked': 'ඉහත ගැටලු නිවැරදි කළ විට නියැදිය දිස් වේ.',

  /* මේ සෑම එකක්ම සුරැකීම නවත්වයි: වැරදි පිරිසැලසුමක ප්‍රතිඵලය බැංකුව ප්‍රතික්ෂේප
     කරන ගොනුවක් වන අතර, එය සොයාගන්නේ නොගෙවුණු සැපයුම්කරුවෙකි. */
  'config.impact.payoutTemplate.no-columns':
    'ගොනුවේ තීරු නැත, එබැවින් එය හිස් වනු ඇත. අවම වශයෙන් මුදල එක් කරන්න.',
  'config.impact.payoutTemplate.no-amount':
    'මුදල් තීරුවක් නැත. එය නොමැති ගොනුවක් යනු ගෙවීම් උපදෙසක් නොව නම් ලැයිස්තුවකි.',
  'config.impact.payoutTemplate.duplicate-field':
    'එකම අගය තීරු දෙකක දිස් වේ. බොහෝ බැංකු උඩුගත කිරීම් එය ප්‍රතික්ෂේප කරයි.',
  'config.impact.payoutTemplate.unknown-field': 'තීරුවක් ගෙවීම් පේළියක නොමැති දෙයකට යොමු වේ.',
  'config.impact.payoutTemplate.missing-label':
    'තීරුවකට ශීර්ෂයක් නැත, සහ ශීර්ෂ සක්‍රීයයි. එය පුරවන්න, නැතහොත් ශීර්ෂ පේළිය අක්‍රීය කරන්න.',
  'config.impact.payoutTemplateBankColumns':
    'තීරු {{count}}ක් බැංකු විස්තර දරයි, එබැවින් චෙක්පත් සහ මුදල් වටවල ඒවා හිස්ව පිටවේ. එය සාමාන්‍යයෙන් කම් නැත — එම වටවල ඒවා පිරී ඇතැයි පමණක් අපේක්ෂා නොකරන්න.',

  'config.impact.fallbackLanguageRequired':
    'ඉංග්‍රීසි ඉවත් කළ නොහැක. පරිවර්තනයක් නොමැති විට සෑම ලිපියක් සහ පිටුවක් එය වෙත ආපසු යොමු වේ.',

  /* ───────────────────────── M15 Users & roles ───────────────────────── */
  /* Every refusal in this module is a version of one failure: a factory locking itself out
     of its own console. The copy has to make that concrete, because "last administrator"
     means nothing until somebody reads what happens if they press on. */
  'users.title': 'පරිශීලකයන් සහ භූමිකා',
  'users.subtitle': 'කොන්සෝලය භාවිත කළ හැක්කේ කාටද, සහ එක් එක් භූමිකාවට කළ හැක්කේ කුමක්ද',
  'users.views': 'පරිශීලකයන් හෝ භූමිකා',
  'users.view.users': 'පුද්ගලයන්',
  'users.view.roles': 'එක් එක් භූමිකාවට කළ හැකි දේ',
  'users.you': '(ඔබ)',
  'users.searchPlaceholder': 'නම හෝ විද්‍යුත් තැපෑල සොයන්න',
  'users.filter.all': 'සියලු දෙනා',
  'users.column.person': 'පුද්ගලයා',
  'users.column.roles': 'භූමිකා',
  'users.column.lastSignIn': 'අවසන් වර පිවිසුණේ',
  'users.status.active': 'සක්‍රීය',
  'users.status.suspended': 'අත්හිටුවා ඇත',
  'users.neverSignedIn': 'කිසිදා නැත',
  'users.lastAdministrator': 'ආපසු ඇතුළු වීමට ඇති එකම මාර්ගය',
  'users.mfaOwed': 'ද්වි-සාධකය සකසා නැත',
  'users.noDeleteHint':
    'ගිණුම් අත්හිටුවනු ලැබේ, කිසිදා මකා නොදමයි — ගෙවීමක් අනුමත කළ හෝ මාසයක් අවසන් කළ පුද්ගලයෙකු එම වාර්තාවල නම් කර ඇත, තවද කර්තෘ සොයාගත නොහැකි වාර්තාවක් සාක්ෂියක් නොවේ.',

  'users.edit': 'සංස්කරණය',
  'users.suspend': 'අත්හිටුවන්න',
  'users.reactivate': 'නැවත සක්‍රීය කරන්න',
  'users.resetMfa': 'ද්වි-සාධකය නැවත සකසන්න',
  'users.invite': 'පරිශීලකයෙකු එකතු කරන්න',
  'users.inviteTitle': 'පරිශීලකයෙකු එකතු කරන්න',
  'users.inviteBody':
    'ඔවුන් පිවිසෙන්නේ මෙම විද්‍යුත් තැපැල් ලිපිනයෙන්. කිසිවක් ස්වයංක්‍රීයව නොයවයි — ඔවුන්ගේ මුරපදය ඔබම ඔවුන්ට කියන්න.',
  'users.editTitle': '{{name}} සංස්කරණය කරන්න',
  'users.editBody': 'භූමිකා වෙනස් කිරීමෙන් ඔවුන් ඊළඟ වර තිරයක් පූරණය කරන විට කළ හැකි දේ වෙනස් වේ.',
  'users.field.name': 'සම්පූර්ණ නම',
  'users.field.email': 'විද්‍යුත් තැපෑල',
  'users.field.emailHint': 'ඔවුන් පිවිසෙන්නේ මෙයින්, තවද පසුව එය වෙනස් කළ නොහැක.',
  'users.field.emailLocked':
    'විද්‍යුත් තැපැල් ලිපිනයක් වෙනස් කළ නොහැක — මෙම පුද්ගලයා දැනටමත් අනුමත කර ඇති සෑම දෙයක ම ඇති නම එයයි.',
  'users.field.roles': 'භූමිකා',
  'users.field.rolesHint':
    'එකකට වඩා තිබීම කිසි ගැටලුවක් නැත. භූමිකා නොගැළපෙන විට, වඩාත් අවසර දෙන එක ක්‍රියාත්මක වේ.',
  'users.cannotEditOwnRoles':
    'ඔබට ඔබේම භූමිකා වෙනස් කළ නොහැක. වෙනත් පරිපාලකයෙකුගෙන් ඉල්ලන්න — කාර්යයක් අඩකින් නවත්වා යමෙකු තමාවම අවහිර කර ගැනීම නවත්වන්නේ මෙයයි.',
  'users.mfaObligation':
    'මෙම පුද්ගලයාට ඇතුළු වීමට පෙර ද්වි-සාධක පිවිසුම සකසා ගැනීමට සිදු වේ. එය කළමනාකරුවන් සහ පරිපාලකයන් සඳහා අවශ්‍ය වේ.',
  'users.created': '{{name}} දැන් පිවිසිය හැක',
  'users.createdHint':
    'ඔවුන්ගේ මුරපදය ඔවුන්ට කියන්න. ඔවුන්ගේ භූමිකාවට අවශ්‍ය නම් ද්වි-සාධකය සකසා ගැනීමට ඉල්ලා සිටිනු ලැබේ.',
  'users.confirmCreateBody': 'තෝරාගත් භූමිකා සමඟ නව කොන්සෝල ගිණුමක් සාදනු ලැබේ.',
  'users.confirmEditBody': 'මෙම පරිශීලකයාගේ ගිණුම් විස්තර සහ ප්‍රවේශය යාවත්කාලීන කරනු ලැබේ.',
  'users.createFailed': 'පරිශීලකයා සාදනු ලැබුවේ නැත',
  'users.updated': '{{name}} යාවත්කාලීන කළා',
  'users.updateFailed': 'කිසිවක් වෙනස් වූයේ නැත',

  'users.suspendTitle': '{{name}} අත්හිටුවන්නද?',
  'users.suspendBody':
    'කිසිවෙකු ඔවුන් නැවත සක්‍රීය කරන තුරු ඔවුන්ට පිවිසිය නොහැක. ඔවුන් දැනටමත් කර ඇති සියල්ල හරියටම එලෙසම පවතී.',
  'users.suspendConfirm': 'ඔවුන් අත්හිටුවන්න',
  'users.suspendDone': '{{name}}ට තවදුරටත් පිවිසිය නොහැක',
  'users.suspendFailed': 'කිසිවක් වෙනස් වූයේ නැත',
  'users.reactivateTitle': '{{name}} නැවත සක්‍රීය කරන්නද?',
  'users.reactivateBody': 'ඔවුන්ට තිබූ භූමිකා සමඟම ඔවුන්ට වහාම නැවත පිවිසිය හැක.',
  'users.reactivateConfirm': 'ඔවුන් නැවත සක්‍රීය කරන්න',
  'users.reactivateDone': '{{name}}ට නැවත පිවිසිය හැක',
  'users.reactivateFailed': 'කිසිවක් වෙනස් වූයේ නැත',
  'users.mfaTitle': '{{name}} සඳහා ද්වි-සාධකය නැවත සකසන්නද?',
  'users.mfaBody':
    'යමෙකුගේ දුරකථනය නැති වූ විට මෙය භාවිත කරන්න. ඔවුන් ඊළඟ වර පිවිසෙන විට එය නැවත සකසා ගනී — එතෙක්, ඔවුන්ගේ මුරපදය පමණක් ඔවුන්ට ඇතුළු වීමට ප්‍රමාණවත්. ඔබ කතා කරන්නේ කවුරුන් සමඟද යන්න ස්ථිර වූ විට පමණක් මෙය කරන්න.',
  'users.mfaConfirm': 'නැවත සකසන්න',
  'users.mfaDone': '{{name}} සඳහා ද්වි-සාධකය නැවත සකස් කළා',
  'users.mfaFailed': 'කිසිවක් වෙනස් වූයේ නැත',
  'users.reasonHint': 'අවම අකුරු {{min}}ක්. මෙය සිදු වන පුද්ගලයා ඇයි කියා අසනු ඇත.',
  'users.confirmActionBody': '{{action}} සඳහා ඉල්ලූ ක්‍රියාව සිදු කරනු ලැබේ.',

  'users.role.clerk': 'ලිපිකරු',
  'users.role.weigher': 'බර කරන්නා',
  'users.role.accountant': 'ගණකාධිකාරී',
  'users.role.manager': 'කළමනාකරු',
  'users.role.editor': 'සංස්කාරක',
  'users.role.factoryAdmin': 'කර්මාන්තශාලා පරිපාලක',
  'users.role.platformAdmin': 'වේදිකා පරිපාලක',

  'users.matrixTitle': 'එක් එක් භූමිකාවට කළ හැකි දේ',
  'users.matrixDescription':
    'මෙහි භූමිකාවක් වෙනස් කළ විට එය එය ඇති සැමට වෙනස් වේ. කිසිවක් ස්ථාපනය කිරීමට අවශ්‍ය නැත.',
  'users.matrixDefault': 'සම්මත භූමිකා',
  'users.matrixCustomised': 'මෙම කර්මාන්තශාලාව සඳහා වෙනස් කර ඇත',
  'users.matrixChanged': 'අවසන් වර {{name}} විසින් {{when}} වෙනස් කරන ලදී.',
  'users.matrixWarning':
    'මේවා ක්‍රියාත්මක වන්නේ යමෙකු ඊළඟ වර තිරයක් පූරණය කරන විටය. භූමිකාවක් පුළුල් කිරීමෙන් එය එම භූමිකාව ඇති සැමට ලැබේ, දැන් පිවිසී සිටින අය ද ඇතුළුව.',
  'users.matrixReadOnly': 'භූමිකාවකට කළ හැකි දේ වෙනස් කළ හැක්කේ කර්මාන්තශාලා පරිපාලකට පමණි.',
  'users.capability': 'කළ හැකි දේ',
  'users.grantFor': '{{role}} සඳහා {{capability}}',
  'users.recoveryCapabilityHint':
    'පරිශීලකයන් කළමනාකරණය කිරීමට යමෙකුට ඉඩ දෙන්නේ මෙයයි. අවම වශයෙන් එක් භූමිකාවක් එය රඳවා ගත යුතුය, නැතහොත් කිසිවෙකුට නැවත ඇතුළු විය නොහැක.',
  'users.matrixLockoutTitle': 'එයින් සියලු දෙනා අවහිර වනු ඇත',
  'users.matrixLockoutBody':
    'පරිශීලකයන් කළමනාකරණය කළ හැකි කිසිදු භූමිකාවක් ඉතිරි නොවනු ඇත, එබැවින් කිසිවෙකුට කිසිදා මෙය නැවත වෙනස් කළ නොහැක. එය කළ හැකි අවම වශයෙන් එක් භූමිකාවක් ඉතිරි කරන්න.',
  'users.roleSaved': '{{role}} යාවත්කාලීන කළා',
  'users.roleSaveFailed': 'කිසිවක් වෙනස් වූයේ නැත',

  'users.level.none': '—',
  'users.level.read': 'බැලීම',
  'users.level.write': 'වෙනස් කිරීම',
  'users.level.approve': 'අනුමත කිරීම',

  'users.capabilityName.suppliers': 'සැපයුම්කරුවන්',
  'users.capabilityName.deliveries': 'දළු එකතු කිරීම',
  'users.capabilityName.ratesAndMonthClose': 'මිල සහ මාසය අවසන් කිරීම',
  'users.capabilityName.billing': 'බිල්පත් සහ ඉතුරුම්',
  'users.capabilityName.payouts': 'ගෙවීම්',
  'users.capabilityName.creditRequests': 'ණය ඉල්ලීම්',
  'users.capabilityName.creditAboveThreshold': 'විශාල ණය ඉල්ලීම්',
  'users.capabilityName.changeRequests': 'වෙනස් කිරීමේ ඉල්ලීම්',
  'users.capabilityName.inquiries': 'සැපයුම්කරුවන්ගේ පණිවිඩ',
  'users.capabilityName.content': 'පුවත් සහ පිටු',
  'users.capabilityName.flagsAndBranding': 'වින්‍යාසය',
  'users.capabilityName.usersAndRoles': 'පරිශීලකයන් සහ භූමිකා',
  'users.capabilityName.reports': 'වාර්තා සහ උපකරණ පුවරුව',
  'users.capabilityName.auditLog': 'විගණන ලොගය',
  'users.capabilityName.tenants': 'අනෙකුත් කර්මාන්තශාලා',

  /* ───────────────────────────── M16 Reports ───────────────────────────── */
  /* The list is short on purpose and the copy says so: §19.1's warehouse shape is what the
     rest of M16 needs, and §19.1 is not in this repository. */
  'reports.title': 'වාර්තා',
  'reports.subtitle': 'ඔබ බලන සෑම වර, වාර්තාවලින් කෙළින්ම ලබා ගත් අගයන්',
  'reports.available': 'වාර්තා',
  'reports.results': 'ප්‍රතිඵල',
  'reports.rows': 'පේළි',
  'reports.total': 'එකතුව',
  'reports.generatedAt': '{{when}} ගණනය කළා',
  'reports.runsAutomatically': 'ඉහත ඕනෑම දෙයක් වෙනස් කළ විට අගයන් යාවත්කාලීන වේ.',
  'reports.needsParams': 'පළමුව ඉහත විකල්ප තෝරන්න.',
  'reports.noParams': 'තවම පෙන්වීමට කිසිවක් නැත',
  'reports.noParamsHint': 'වාර්තාව ආවරණය කළ යුතු දේ තෝරන්න.',
  'reports.empty': 'පේළි නැත',
  'reports.emptyHint': 'ඔබ ඉල්ලූ දෙයට වාර්තාවල කිසිවක් නොගැළපේ.',
  'reports.shortListNote':
    'දැනට මේ හතර පමණි. සෑම එකක්ම කොන්සෝලය දැනටමත් තබා ගන්නා වාර්තාවලින් සාදා ඇත — කර්මාන්තශාලාව ඉල්ලූ ඉතිරි වාර්තා සඳහා වෙනම වාර්තාකරණ දත්ත ගබඩාවක් අවශ්‍ය වන අතර, එය තවම නොපවතී.',
  'reports.noExportNote':
    'තවම බාගැනීමක් නැත. එතෙක් ඔබට වගුව තෝරා පැතුරුම්පතකට ඇලවිය හැක.',

  'reports.name.monthSummary': 'මාසික සාරාංශය',
  'reports.description.monthSummary':
    'මාසයක් එක බැල්මකින්: දළු, මිල, බිල්පත් වලින් ලැබුණු අගය, සහ ඉතුරුම් ලෙස තබා ගෙන ඇති අගය.',
  'reports.name.leafByCollectionPoint': 'එකතු කිරීමේ ස්ථානය අනුව දළු',
  'reports.description.leafByCollectionPoint':
    'මාසයේ දළු පැමිණියේ කොහෙන්ද, සහ එක් ස්ථානයක් තවත් එකක් සමඟ සසඳන ආකාරය.',
  'reports.name.dormantSuppliers': 'නතර වී ඇති සැපයුම්කරුවන්',
  'reports.description.dormantSuppliers':
    'කලක් තිස්සේ දළු නොමැති ලියාපදිංචි සැපයුම්කරුවන් — සහ කර්මාන්තශාලාව තවමත් ඔවුන් වෙනුවෙන් තබා ගෙන සිටින දේ.',
  'reports.name.channelShift': 'කාලයාගේ ඇවෑමෙන් යෙදුමේ භාවිතය',
  'reports.description.channelShift':
    'සැපයුම්කරුවන් යෙදුමෙන් තමන්ම ඉදිරිපත් කරන ඉල්ලීම් ගණන, කාර්යාලය ඔවුන් වෙනුවෙන් ඇතුළත් කරන ගණනට සාපේක්ෂව.',

  'reports.param.dormantMonths': 'අවම වශයෙන් මෙපමණ කලක් දළු නැත',
  'reports.param.dormantMonthsHint': 'මාස.',
  'reports.param.from': 'සිට',
  'reports.param.to': 'දක්වා',

  'reports.column.metric': 'අගය',
  'reports.column.value': 'ප්‍රමාණය',
  'reports.column.point': 'එකතු කිරීමේ ස්ථානය',
  'reports.column.kgs': 'කිලෝ',
  'reports.column.suppliers': 'සැපයුම්කරුවන්',
  'reports.column.deliveries': 'බර කිරීම්',
  'reports.column.meanKgs': 'බර කිරීමකට සාමාන්‍යය',
  'reports.column.code': 'අංකය',
  'reports.column.name': 'නම',
  'reports.column.lastDelivery': 'අවසන් භාරය',
  'reports.column.savings': 'තබා ගෙන ඇති ඉතුරුම්',
  'reports.column.credit': 'ගෙවිය යුතු',
  'reports.column.month': 'මාසය',
  'reports.column.fromApp': 'යෙදුමෙන්',
  'reports.column.fromOffice': 'අතින් ඇතුළත් කළ',
  'reports.column.total': 'එකතුව',
  'reports.column.appShare': 'යෙදුමේ කොටස',

  'reports.metric.stage': 'මාසය පවතින තැන',
  'reports.metric.totalKgs': 'දළු',
  'reports.metric.supplierCount': 'සැපයුම්කරුවන්',
  'reports.metric.deliveryCount': 'බර කිරීම්',
  'reports.metric.ratePerKg': 'කිලෝවකට මිල',
  'reports.metric.extraRatePerKg': 'කිලෝවකට අමතර',
  'reports.metric.billCount': 'බිල්පත්',
  'reports.metric.grossTotal': 'දළ එකතුව',
  'reports.metric.payableTotal': 'ගෙවිය යුතු',
  'reports.metric.savingsTotal': 'තබා ගෙන ඇති ඉතුරුම්',

  /* ─────────────────────────────── errors ─────────────────────────────── */
  'error.title': 'යමක් වැරදී ඇත',
  'error.network': 'කර්මාන්තශාලා සේවාදායකයට සම්බන්ධතාවක් නැත. ජාලය පරීක්ෂා කර නැවත උත්සාහ කරන්න.',
  'error.timeout': 'සේවාදායකය පිළිතුරු දීමට ඉතා දිගු කාලයක් ගත් විය. නැවත උත්සාහ කරන්න.',
  'error.forbidden': 'ඔබේ භූමිකාව මෙයට ඉඩ නොදේ.',
  'error.featureDisabled': 'මෙම කර්මාන්තශාලාව එම විශේෂාංගය භාවිත නොකරයි.',
  'error.notFound': 'එම වාර්තාව තවදුරටත් නොපවතී.',
  'error.invalid': 'විද්‍යුත් තැපෑල හෝ මුරපදය වැරදිය.',
  'error.mfaInvalid': 'එම කේතය නිවැරදි නොවේ.',
  'error.noteRequired': 'මෙය වාර්තා කිරීමට පෙර සටහනක් අවශ්‍යයි.',
  'error.fourEyesViolation': 'ඔබ මෙම වාර්තාව ඉදිරිපත් කළ බැවින්, ඔබට එය අනුමත කළ නොහැක.',
  'error.alreadyDecided': 'වෙනත් අයෙක් දැනටමත් මෙය තීරණය කර ඇත.',
  'error.alreadyPublished': 'එම මාසය දැනටමත් ප්‍රකාශයට පත් කර ඇත.',
  'error.exceptionsOpen':
    'මාසයේ තවමත් විසඳා නැති කරුණු ඇත. ප්‍රකාශයට පත් කිරීමට පෙර ඒ සෑම එකක්ම විසඳන්න.',
  'error.rateMissing': 'මෙම මාසය සඳහා වෙන්දේසි මිල තවම ඇතුළත් කර නැත.',
  'error.invalidRate': 'එය කර්මාන්තශාලාවට වාර්තා කළ හැකි මිලක් නොවේ.',
  'error.alreadyResolved': 'වෙනත් අයෙක් දැනටමත් මෙය විසඳා ඇත.',
  'error.monthMismatch':
    'තිරය පෙන්වන්නේ ප්‍රකාශයට පත් කරන මාසයට වෙනස් මාසයකි. නැවත පූරණය කර පරීක්ෂා කරන්න.',
  'error.monthLocked': 'එම මාසය ප්‍රකාශයට පත් කර ඇති බැවින්, එහි අගයන් තවදුරටත් වෙනස් කළ නොහැක.',
  'error.alreadyVoided': 'මෙම දළු භාරය දැනටමත් අවලංගු කර ඇත.',
  'error.invalidBatch': 'පේළිවලින් එකක් කර්මාන්තශාලාවට වාර්තා කළ හැකි දෙයක් නොවේ. කිලෝ පරීක්ෂා කරන්න.',
  'error.batchTooLarge': 'එය එක් සැසියකට දැරිය හැකි ප්‍රමාණයට වඩා පේළි වැඩියි. කිහිපයක් වාර්තා කර, ඉන්පසු ඉදිරියට යන්න.',
  'error.staleEligibility': 'මෙය විවෘතව තිබූ අතරතුර අගයන් වෙනස් විය. නැවත පූරණය කර ඒවා නැවත පරීක්ෂා කරන්න.',
  'error.billsMissing': 'එම මාසය සඳහා බිල්පත් තවම සාදා නැත.',
  'error.billsStale':
    'බිල්පත් සාදා ඇති පසු දළු වෙනස් වී ඇත. ප්‍රකාශයට පත් කිරීමට පෙර ඒවා නැවත සාදන්න.',
  'error.billsUnbalanced':
    'සමහර බිල්පත්වල අඩු කිරීමේ පේළි ඒවායේ එකතුවට නොගැළපේ. කර්මාන්තශාලා පරිපාලකට දන්වන්න — කිසිවක් සාදා නැත.',
  'error.monthNotPublished':
    'එම මාසය තවම ප්‍රකාශයට පත් කර නැත, එබැවින් එහි අගයන් තවමත් වෙනස් විය හැක. එයට එරෙහිව ගෙවීමට පෙර එය අවසන් කරන්න.',
  'error.runExists': 'එම මාසය සහ ගෙවීම් ක්‍රමය සඳහා ගෙවීම් වටයක් දැනටමත් පවතී.',
  'error.alreadyApproved': 'එම වටය දැනටමත් නිකුත් කර ඇත.',
  'error.runNotApproved': 'එම වටය තවම නිකුත් කර නැත, එබැවින් එහි කිසිවක් ගෙවා නැත.',
  'error.noPayableLines': 'එම වටයේ ගෙවිය යුතු කිසිවක් නැත.',
  'error.lineNotPayable': 'එම පේළිය ගෙවිය නොහැක — එය රඳවා ඇත, නැතහොත් එය දැනටමත් ගෙවා ඇත.',
  'error.overCeiling': 'එය මෙම සැපයුම්කරුට එම පහසුකමෙන් ලබා ගත හැකි ප්‍රමාණයට වඩා වැඩිය.',
  'error.fallbackTranslationMissing':
    'ඉංග්‍රීසි පිටපතක් නැත, එබැවින් සැපයුම්කරුවෙකුට පෙන්වීමට කිසිවක් නොවනු ඇත. පළමුව එය ලියන්න.',
  'error.slugTaken': 'එම මාතෘකාව සහිත ලිපියක් දැනටමත් පවතී.',
  'error.contentNotPublished': 'එය සක්‍රීය නොවේ, එබැවින් ඉවත් කිරීමට කිසිවක් නැත.',
  'error.url': 'වලංගු වෙබ් ලිපිනයක් ඇතුළත් කරන්න',
  'error.unknownCategory':
    'යෙදුම එය ඉවතට දමනු ඇත — එය විවෘත කරන්නේ හඳුනා ගන්නා වර්ගයේ දැනුම්දීම් පමණි.',
  'error.categoryDisabled': 'මෙම කර්මාන්තශාලාව එම වර්ගයේ දැනුම්දීම් නොයවයි.',
  'error.noRecipients':
    'එම පිරිසේ කිසිදු දුරකථනයක් මෙම වර්ගයේ දැනුම්දීම් පිළිගන්නේ නැත, එබැවින් කිසිවක් නොලැබෙනු ඇත.',
  'error.pushNotConfigured':
    'මෙම කර්මාන්තශාලාව සඳහා දැනුම්දීම් සක්‍රීය කර ඇති නමුත් තවම කිසිදු වර්ගයක් සකසා නැත. එය කරන්නේ වින්‍යාසය තුළය.',
  'error.tenantImmutable': 'කර්මාන්තශාලා හැඳුනුම වෙබ් ලිපිනයෙන් පැමිණේ, එබැවින් එය වෙනස් කළ නොහැක.',
  'error.flagHasRecords':
    'එම විශේෂාංගය කර්මාන්තශාලාවට තවමත් වගකිව යුතු වාර්තා දරා සිටී, එබැවින් එය තවම අක්‍රීය කළ නොහැක.',
  'error.pointInUse': 'එම එකතු කිරීමේ ස්ථානය යටතේ බර කිරීම් ගොනු කර ඇති බැවින් එය ඉවත් කළ නොහැක.',
  'error.fallbackLanguageRequired':
    'ඉංග්‍රීසි ඉවත් කළ නොහැක — සෑම ලිපියක් සහ පිටුවක් එය වෙත ආපසු යොමු වේ.',
  'error.lastAdmin':
    'එයින් පරිශීලකයන් කළමනාකරණය කළ හැකි කිසිවෙකු ඉතිරි නොවනු ඇත, එබැවින් කිසිවෙකුට එය අස් කළ නොහැක. පළමුව වෙනත් අයෙකුට එම භූමිකාව දෙන්න.',
  'error.selfModification': 'ඔබට ඔබේම ගිණුමට එය කළ නොහැක. වෙනත් පරිපාලකයෙකුගෙන් ඉල්ලන්න.',
  'error.emailTaken': 'එම විද්‍යුත් තැපැල් ලිපිනයට දැනටමත් ගිණුමක් ඇත.',
  'error.unknownRole': 'එවැනි භූමිකාවක් නැත.',
  'error.unknown': 'අනපේක්ෂිත දෝෂයකි. එය දිගටම සිදු වේ නම්, කර්මාන්තශාලා පරිපාලකට දන්වන්න.',
  'error.boundaryTitle': 'මෙම තිරය පෙන්විය නොහැකි විය',
  'error.boundaryBody': 'කොන්සෝලයේ ඉතිරි කොටස තවමත් ක්‍රියා කරයි. නැවත උත්සාහ කිරීමට මෙම පිටුව නැවත පූරණය කරන්න.',
  'error.reload': 'නැවත පූරණය කරන්න',

  /* ─────────────────── M18 තේ පැකට් ඉල්ලීම් (v2) ─────────────────── */
  'teaPackets.title': 'තේ පැකට්',
  'teaPackets.subtitle':
    'කර්මාන්තශාලාවේම තේ පැකට්. යෙදුමෙන් ඉල්ලා, ඊළඟ ගිණුමෙන් අය කර ගැනේ.',
  'teaPackets.column.supplier': 'සැපයුම්කරු',
  'teaPackets.column.packets': 'පැකට්',
  'teaPackets.column.delivery': 'ලබා ගන්නා ආකාරය',
  'teaPackets.column.amount': 'වටිනාකම',
  'teaPackets.column.age': 'රැඳී සිටි කාලය',
  'teaPackets.weight': 'කි.ග්‍රෑ. {{kg}}',
  'teaPackets.unitPrice': 'එකකට {{price}}',
  'teaPackets.packetsWithWeight': 'පැකට් {{packets}} · කි.ග්‍රෑ. {{kg}}',
  'teaPackets.request': 'ඉල්ලා ඇත',
  'teaPackets.supplierNote': 'සැපයුම්කරුගේ සටහන',
  'teaPackets.delivery.factoryCollection': 'ගබඩාවෙන් ලබා ගැනීම',
  'teaPackets.delivery.transportVehicle': 'එකතු කිරීමේ වාහනයෙන්',
  'teaPackets.status.pending': 'රැඳී ඇත',
  'teaPackets.status.approved': 'අනුමතයි',
  'teaPackets.status.rejected': 'ප්‍රතික්ෂේපයි',
  'teaPackets.filter.pending': 'රැඳී ඇත',
  'teaPackets.filter.approved': 'අනුමතයි',
  'teaPackets.filter.rejected': 'ප්‍රතික්ෂේපයි',
  'teaPackets.filter.allDelivery': 'ඕනෑම ආකාරයක්',
  'teaPackets.decide': 'තීරණය කරන්න',
  'teaPackets.decideTitle': 'මෙම තේ පැකට් ඉල්ලීම තීරණය කරන්න',
  'teaPackets.decideBody':
    'වටිනාකම සැපයුම්කරුගේ ඊළඟ කොළ ගිණුමෙන් අඩු කෙරේ. ඔවුන් කියවන්නේ මෙම සටහනයි.',
  'teaPackets.approve': 'අනුමත කරන්න',
  'teaPackets.reject': 'ප්‍රතික්ෂේප කරන්න',
  'teaPackets.approved': 'ඉල්ලීම අනුමත කෙරිණි',
  'teaPackets.rejected': 'ඉල්ලීම ප්‍රතික්ෂේප කෙරිණි',
  'teaPackets.noteLabel': 'තීරණයේ සටහන',
  'teaPackets.noteHelp': 'අවම අකුරු 10ක්. සැපයුම්කරු මෙය යෙදුමේ කියවයි.',
  'teaPackets.notePlaceholder': 'සඳුදා සිට ගබඩාවෙන් ලබා ගත හැක.',
  'teaPackets.empty': 'රැඳී ඇති කිසිවක් නැත',
  'teaPackets.emptyHint': 'යෙදුමෙන් එන ඉල්ලීම්, පැරණිතම මුලින්, මෙහි පෙනේ.',
  'teaPackets.fourEyes.short': 'මෙය ඔබ ඉදිරිපත් කළේය',
  'teaPackets.fourEyes.title': 'මෙම ඉල්ලීම ඉදිරිපත් කළේ ඔබයි.',
  'teaPackets.fourEyes.body': 'එය තීරණය කළ යුත්තේ වෙනත් අයෙකි (BR-501).',
  'teaPackets.alreadyDecided.title': 'දැනටමත් තීරණය කර ඇත.',
  'teaPackets.alreadyDecided.body':
    'මෙම පෝලිම විවෘතව තිබියදී වෙනත් පරිශීලකයෙක් මෙය තීරණය කර ඇත. තිරය නැවුම් කර ඇත.',
  'teaPackets.problem.title': 'කර්මාන්තශාලාවේ ප්‍රතිපත්තියෙන් පිටත.',
  'teaPackets.problem.no-packets': 'ඉල්ලීම පැකට් කිසිවක් සඳහා නොවේ.',
  'teaPackets.problem.not-whole': 'ගබඩාව නිකුත් කරන්නේ සම්පූර්ණ පැකට් පමණි.',
  'teaPackets.problem.over-max': 'එක් ඉල්ලීමකට පැකට් {{max}}කට වඩා වැඩියි.',
  'teaPackets.noPolicy.title': 'තේ පැකට් මිලක් තවම නියම කර නැත.',
  'teaPackets.noPolicy.body':
    'මෙම ඉල්ලීම් මිල ගණන් කරන්නේ පැකට්ටුවකට {{price}} යන පෙරනිමි අගය අනුවයි. කර්මාන්තශාලාවේම මිල "වින්‍යාසය" යටතේ ඇතුළත් කරන්න.',

  /* ───────────────────────── M11 ප්‍රවර්ධන බැනර් (v2) ───────────────────────── */
  'banners.title': 'ප්‍රවර්ධන බැනර්',
  'banners.subtitle':
    'යෙදුමට ඇතුළු වන විට සැපයුම්කරුට පෙනෙන පූර්ණ පළල නිවේදනය. බොත්තමක්, ක්‍රියාත්මක වන කාල පරාසයක්.',
  'banners.create': 'නව බැනරයක්',
  'banners.createTitle': 'නව බැනරයක්',
  'banners.createDescription':
    'මුලින්ම {{language}} බසින් ලියන්න. අනෙක් භාෂා ඊළඟ තිරයේදී එකතු කරන්න.',
  'banners.createConfirm': 'බැනරය සාදන්න',
  'banners.createDraftHint':
    'එය කෙටුම්පතක් ලෙස සෑදේ. ප්‍රකාශ කරන්නේ කර්මාන්තශාලා පරිපාලකයෙකි.',
  'banners.created': 'බැනරය සෑදිණි',
  'banners.createdHint': 'අනෙක් භාෂා සහ පින්තූරය එකතු කරන්න.',
  'banners.createFailed': 'බැනරය සෑදිය නොහැකි විය',
  'banners.backToList': 'සියලු බැනර්',
  'banners.untitled': 'නම් නොකළ බැනරය',
  'banners.column.title': 'ශීර්ෂය',
  'banners.column.window': 'ක්‍රියාත්මක කාලය',
  'banners.column.languages': 'භාෂා',
  'banners.searchPlaceholder': 'ශීර්ෂ සොයන්න',
  'banners.complete': 'සියල්ල ලියා ඇත',
  'banners.missingCount': 'භාෂා {{count}}ක් නැත',
  'banners.noArtwork': 'පින්තූරයක් නැත — යෙදුම වෙළඳ නාමයේ පැනලයක් අඳියි',
  'banners.noEnd': 'ඉවත් කරන තෙක්',
  'banners.lens.all': 'සියලු බැනර්',
  'banners.window.scheduled': 'කාලසටහන්ගත',
  'banners.window.live': 'ක්‍රියාත්මකයි',
  'banners.window.expired': 'අවසන්',
  'banners.window.backwards': 'අවසානය ආරම්භයෙන් පසුව විය යුතුය.',
  'banners.status.draft': 'කෙටුම්පත',
  'banners.status.published': 'ප්‍රකාශිතයි',
  'banners.status.archived': 'සංරක්ෂිතයි',
  'banners.noneLive': 'කිසිවක් පෙන්වන්නේ නැත',
  'banners.noneLiveHint': 'මේ මොහොතේ ක්‍රියාත්මක කාලය තුළ බැනරයක් නැත.',
  'banners.empty': 'තවම බැනර් නැත',
  'banners.emptyHint': 'බැනරයක් යනු බොත්තමක් සහිත එක් නිවේදනයකි. පළමුවැන්න සාදන්න.',
  'banners.field.headline': 'ශීර්ෂය',
  'banners.field.headlineHint': 'කෙටියෙන්. එය කියවන්නේ දුරකථනයකින්, යෙදුමට ඇතුළු වන විටයි.',
  'banners.field.body': 'උපකාරක වාක්‍යය',
  'banners.field.bodyHint': 'අත්‍යවශ්‍ය නොවේ. ශීර්ෂයක් සහ බොත්තමක් ප්‍රමාණවත්.',
  'banners.field.buttonLabel': 'බොත්තමේ නම',
  'banners.field.buttonHint': 'බොත්තමේ ලියැවෙන දේ. එය යන තැන පහතින් නියම කරන්න.',
  'banners.field.buttonHintLong':
    'අකුරු {{max}}ක් දක්වා — දිගු නමක් කුඩා දුරකථනයකින් පිටතට යයි.',
  'banners.field.startsAt': 'ආරම්භය',
  'banners.field.endsAt': 'අවසානය',
  'banners.field.endsAtHint': 'ඉවත් කරන තෙක් ක්‍රියාත්මක වීමට හිස්ව තබන්න.',
  'banners.action.kind': 'බොත්තම විවෘත කරන්නේ',
  'banners.action.kindHint':
    'යෙදුමේ තිරයක්, නැතහොත් යෙදුමෙන් පිටතට යන සබැඳියක්. දෙකම යෙදුම සැබවින්ම විවෘත කරන දේට එරෙහිව පරීක්ෂා කෙරේ.',
  'banners.action.screen': 'යෙදුමේ තිරයක්',
  'banners.action.url': 'යෙදුමෙන් පිටත සබැඳියක්',
  'banners.action.pathLabel': 'යෙදුමේ තිරය',
  'banners.action.pathHint':
    'කුඩා අකුරින්, යෝජනා ක්‍රමයක් හෝ විමසුම් තන්තුවක් නොමැතිව — උදාහරණයක් ලෙස news/news-1.',
  'banners.action.urlLabel': 'සබැඳිය',
  'banners.action.urlHint': 'https, tel හෝ mailto පමණි.',
  'banners.action.missing': 'බොත්තමට යාමට තැනක් අවශ්‍යයි.',
  'banners.action.badPath':
    'යෙදුමට එම මාර්ගය විවෘත කළ නොහැක. කුඩා අකුරු, ඉලක්කම් සහ ඉරි, ස්ලෑෂ් වලින් වෙන් කර.',
  'banners.action.badUrl': 'යෙදුම විවෘත කරන්නේ https, tel සහ mailto සබැඳි පමණි.',
  'banners.action.appSchemeRefused':
    'යෙදුම තුළම යන තැනකට "යෙදුමේ තිරයක්" භාවිත කරන්න — යෙදුම teafactory:// සබැඳි ප්‍රතික්ෂේප කරයි.',
  'banners.action.resolvedScreen': 'බොත්තම යෙදුමේ {{path}} තිරය විවෘත කරයි.',
  'banners.action.resolvedUrl': 'බොත්තම {{url}} විවෘත කරයි.',
  'banners.copyTitle': 'පිටපත',
  'banners.copyDescription': 'ශීර්ෂය සහ බොත්තමේ නම, කර්මාන්තශාලාව ලියන සෑම භාෂාවකින්ම.',
  'banners.saveNeedsCopy': 'සුරැකීමට පෙර ශීර්ෂයක් සහ බොත්තමේ නමක් අවශ්‍යයි.',
  'banners.settingsTitle': 'බොත්තම සහ කාලය',
  'banners.settingsDescription':
    'බොත්තම යන තැන, සහ බැනරය සැපයුම්කරුවන් ඉදිරියේ තිබෙන කාලය. පරිවර්තනය නොවේ — සෑම භාෂාවකටම එකම ගමනාන්තයයි.',
  'banners.saveSettings': 'බොත්තම සහ කාලය සුරකින්න',
  'banners.settingsSaved': 'බොත්තම සහ කාලය සුරැකිණි',
  'banners.settingsSaveFailed': 'සුරැකිය නොහැකි විය',
  'banners.settingsCurrent': 'සුරැකී ඇත.',
  'banners.gapNotice':
    '{{languages}} බසින් කිසිවක් ලියා නැත. එම භාෂාවලින් කියවන සැපයුම්කරුවන්ට පෙනෙන්නේ {{fallback}} පිටපතයි.',
  'banners.notLive.scheduledTitle': 'ප්‍රකාශිතයි, නමුත් තවම පෙන්වන්නේ නැත.',
  'banners.notLive.scheduledBody': 'ක්‍රියාත්මක කාලය ආරම්භ වූ විට එය පෙනේ.',
  'banners.notLive.expiredTitle': 'ප්‍රකාශිතයි, නමුත් අවසන්.',
  'banners.notLive.expiredBody': 'ක්‍රියාත්මක කාලය අවසන් වී ඇති නිසා කිසිදු සැපයුම්කරුවෙකුට නොපෙනේ.',
  'banners.lifecycleTitle': 'ප්‍රකාශනය',
  'banners.lifecycleDraft': 'කෙටුම්පතක් කිසිවෙකු ඉදිරියේ නැත.',
  'banners.lifecyclePublished': 'ප්‍රකාශිතයි — ක්‍රියාත්මක කාලය තුළ එය පෙනේ.',
  'banners.publish': 'ප්‍රකාශ කරන්න',
  'banners.unpublish': 'ඉවත් කරන්න',
  'banners.archive': 'සංරක්ෂණය කරන්න',
  'banners.published': 'බැනරය ප්‍රකාශ කෙරිණි',
  'banners.unpublished': 'බැනරය ඉවත් කෙරිණි',
  'banners.archived': 'බැනරය සංරක්ෂණය කෙරිණි',
  'banners.publishFailed': 'ප්‍රකාශ කළ නොහැකි විය',
  'banners.unpublishFailed': 'ඉවත් කළ නොහැකි විය',
  'banners.archiveFailed': 'සංරක්ෂණය කළ නොහැකි විය',
  'banners.publishedBy': '{{when}} දින {{name}} විසින් ප්‍රකාශ කරන ලදී',
  'banners.publishNeedsAdmin': 'බැනර් ප්‍රකාශ කරන්නේ කර්මාන්තශාලා පරිපාලකයෙකි.',
  'banners.publishNeedsAction':
    'ප්‍රකාශ කිරීමට පෙර බොත්තම නිවැරදි කරන්න — යෙදුම බොත්තමක් කිසිසේත් අඳින්නේ නැත.',
  'banners.noDeleteHint': 'බැනර් සංරක්ෂණය කෙරේ, කිසිවිටෙක මකා නොදමයි.',
  'banners.auditTitle': 'බැනර ඉතිහාසය',
  'banners.confirm.publishTitle': 'මෙම බැනරය ප්‍රකාශ කරන්නද?',
  'banners.confirm.publishBody': 'සෑම සැපයුම්කරුවෙකුම යෙදුමට ඇතුළු වන විට එය වරක් දකියි.',
  'banners.confirm.publishAction': 'ප්‍රකාශ කරන්න',
  'banners.confirm.unpublishTitle': 'මෙම බැනරය ඉවත් කරන්නද?',
  'banners.confirm.unpublishBody': 'කාලය කුමක් වුවත් එය වහාම පෙන්වීම නවතී.',
  'banners.confirm.unpublishAction': 'ඉවත් කරන්න',
  'banners.confirm.archiveTitle': 'මෙම බැනරය සංරක්ෂණය කරන්නද?',
  'banners.confirm.archiveBody': 'එය ලැයිස්තුවෙන් ඉවත් වේ. කිසිවක් මකා නොදමයි.',
  'banners.confirm.archiveAction': 'සංරක්ෂණය කරන්න',
  'banners.confirm.publishWithGaps':
    '{{languages}} බසින් කියවන සැපයුම්කරුවන්ට ඉංග්‍රීසි පිටපත පෙනේ.',
  'banners.confirm.publishLiveNow': 'එය වහාම ක්‍රියාත්මක වේ.',
  'banners.confirm.publishScheduled': 'එය {{when}} දින ක්‍රියාත්මක වේ.',

  /* ───────────────────────────── attachments ───────────────────────────── */
  'attachment.tooLarge': 'එම ලිපිගොනුව 8 MBට වඩා විශාලයි',
  'attachment.badType': 'JPEG, PNG, WebP හෝ PDF ලිපිගොනුවක් අමුණන්න',
  'attachment.uploading': 'උඩුගත වෙමින්…',
  'attachment.remove': 'ඉවත් කරන්න',
} as const;
