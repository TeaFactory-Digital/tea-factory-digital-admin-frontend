/**
 * The console's Tamil string table.
 *
 * `Record<TranslationKey, string>` rather than a bare object, and that is the whole
 * point of the type: a key that exists in `en` and not here is a **compile error**,
 * not a screen that quietly falls back to English in front of a weighing-point
 * clerk. The fallback in `i18n/index.ts` stays as a runtime safety net for a build
 * that somehow ships anyway — it is not the guard.
 *
 * Keys are in en.ts's order, under the same section dividers, so the three files can
 * be read side by side. The dividers stay in English deliberately: they are for
 * whoever maintains the table, and the module names in them (M3, M14) are the
 * repository's own.
 *
 * Two rules for translating this table:
 *
 *  1. **`{{placeholders}}` are code.** The name inside the braces must match en.ts
 *     exactly — the console interpolates by name, so a translated placeholder
 *     renders as literal text.
 *  2. **Domain words follow the printed account, not the dictionary.** An estate
 *     supplier reads கொழுந்து on paper every month, not the literary தேயிலை இலை;
 *     a more literal translation of "green leaf" would be a second name for a thing
 *     that already has one.
 */

import type { TranslationKey } from './en';

export const ta: Record<TranslationKey, string> = {
  /* ─────────────────────────────── common ─────────────────────────────── */
  'common.appName': 'கன்சோல்',
  'common.save': 'சேமிக்கவும்',
  'common.cancel': 'இரத்துச் செய்',
  'common.close': 'மூடு',
  'common.confirm': 'உறுதிப்படுத்து',
  'common.search': 'தேடு',
  'common.filter': 'வடிகட்டி',
  'common.clear': 'அழி',
  'common.retry': 'மீண்டும் முயற்சிக்கவும்',
  'common.loading': 'ஏற்றப்படுகிறது…',
  'common.none': 'இல்லை',
  'common.notAvailable': 'இல்லை',
  'common.yes': 'ஆம்',
  'common.no': 'இல்லை',
  'common.of': '/',
  'common.previous': 'முன்',
  'common.next': 'அடுத்து',
  'common.rowsPerPage': 'வரிசைகள்',
  'common.showing': 'மொத்தம் {{total}}ல் {{from}}–{{to}} காட்டப்படுகிறது',
  // The page controls are icons, so these are the only names they have — they
  // reach the clerk as a tooltip and a screen reader as the accessible name.
  'common.pagination': 'பக்கங்கள்',
  'common.firstPage': 'முதல் பக்கம்',
  'common.previousPage': 'முன்னைய பக்கம்',
  'common.nextPage': 'அடுத்த பக்கம்',
  'common.lastPage': 'இறுதிப் பக்கம்',
  'common.pageOf': 'மொத்தம் {{total}} பக்கங்களில் {{page}}',
  'common.noResults': 'காட்டுவதற்கு எதுவும் இல்லை',
  'common.noResultsHint': 'வேறு தேடலை முயற்சிக்கவும், அல்லது வடிகட்டிகளை அழிக்கவும்.',
  'common.signOut': 'வெளியேறு',
  'shell.signOutConfirmBody': 'கன்சோலில் தொடர்ந்து வேலை செய்ய மீண்டும் உள்நுழைய வேண்டும்.',
  'config.confirmSaveTitle': 'இந்தக் கட்டமைப்பு மாற்றங்களைச் சேமிக்கவா?',
  'config.confirmSaveBody':
    'இந்த மாற்றங்கள் தொழிற்சாலைக் கன்சோல் முழுவதும் மற்ற பகுதிகளையும் அடையாளச் சின்னத்தையும் பாதிக்கும்.',
  'common.copy': 'நகலெடு',
  'common.copied': 'நகலெடுக்கப்பட்டது',
  'common.reason': 'காரணம்',
  'common.note': 'குறிப்பு',
  'common.actor': 'யார்',
  'common.when': 'எப்போது',
  'common.status': 'நிலை',
  'common.actions': 'செயல்கள்',
  'common.required': 'அவசியம்',
  'common.optional': 'அவசியமில்லை',
  'common.back': 'பின்',

  /* ──────────────────────────────── shell ──────────────────────────────── */
  'shell.skipToContent': 'உள்ளடக்கத்திற்குச் செல்',
  'shell.tenantBanner': '{{tenant}} காட்டப்படுகிறது',
  'shell.degradedConfig':
    'தொழிற்சாலைக் கட்டமைப்பை அணுக முடியவில்லை — உள்ளமைந்த இயல்பு மதிப்புகள் காட்டப்படுகின்றன. அடையாளச் சின்னமும் வசதிகளும் காலாவதியாகியிருக்கலாம்.',
  'shell.mockBanner':
    'மாதிரித் தரவு. இதில் எதுவும் உண்மையான பதிவு அல்ல, பக்கத்தை மீண்டும் ஏற்றியபின் எதுவும் எஞ்சாது.',
  'shell.tenantSwitcher': 'தொழிற்சாலை (உருவாக்கம்/மாதிரி மட்டும்)',
  /* The accessible name of the language pill. The options inside it are *not*
     translated — see i18n/languages.ts for why. */
  'shell.language': 'மொழி',

  /* ──────────────────────────────── splash ─────────────────────────────── */
  // The factory's name is the headline on the boot splash; this is the line under
  // it, and it says what is happening rather than naming the product again.
  'splash.subtitle': 'அலுவலகக் கன்சோல் தயாராகிறது…',

  /* ─────────────────────────────── viewport ────────────────────────────── */
  // Shown instead of the console below tablet width (see layout/ViewportGate).
  // It has to name the device to use, not just report a problem: whoever reads
  // this is holding the wrong one.
  'viewport.tooSmallTitle': 'இந்தத் திரை மிகச் சிறியது',
  'viewport.tooSmallBody':
    'அலுவலகக் கன்சோல் டேப்லெட், மடிக்கணினி மற்றும் மேசைக்கணினிக்காக அமைக்கப்பட்டுள்ளது — அதன் அட்டவணைகளும் பக்கவாட்டுப் படிவங்களும் தொலைபேசியில் பொருந்தாது. அதை டேப்லெட்டில் அல்லது கணினியில் திறக்கவும்; சிறிய டேப்லெட்டைப் பக்கவாட்டில் திருப்ப வேண்டியிருக்கும்.',
  'viewport.tooSmallSize':
    'இந்தச் சாளரம் {{width}} × {{height}}. கன்சோலுக்கு குறைந்தது {{minWidth}} × {{minHeight}} தேவை.',

  /* ──────────────────────────── navigation ──────────────────────────── */
  'nav.dashboard': 'முகப்புப் பலகை',
  'nav.suppliers': 'வழங்குநர்கள்',
  'nav.deliveries': 'கொழுந்து சேகரிப்பு',
  'nav.rates': 'விலை மற்றும் மாத நிறைவு',
  'nav.bills': 'பில்கள்',
  'nav.payouts': 'கொடுப்பனவுகள்',
  'nav.credit': 'கடன் வரிசைகள்',
  'nav.savings': 'சேமிப்பு',
  'nav.changeRequests': 'மாற்ற வேண்டுகோள்கள்',
  'nav.inquiries': 'விசாரணைகள்',
  'nav.news': 'செய்திகள்',
  'nav.content': 'நிலையான பக்கங்கள்',
  'nav.notifications': 'அறிவிப்புகள்',
  'nav.configuration': 'கட்டமைப்பு',
  'nav.users': 'பயனர்கள் மற்றும் பதவிகள்',
  'nav.reports': 'அறிக்கைகள்',
  'nav.audit': 'தணிக்கைப் பதிவு',
  'nav.sectionOperations': 'அன்றாட வேலை',
  'nav.sectionMoney': 'பணம்',
  'nav.sectionQueues': 'வரிசைகள்',
  'nav.sectionContent': 'உள்ளடக்கம்',
  'nav.sectionAdmin': 'நிர்வாகம்',

  /* ──────────────────────────────── auth ──────────────────────────────── */
  'auth.signInTitle': 'கன்சோலில் உள்நுழையவும்',
  'auth.signInSubtitle': '{{factory}} க்கான அலுவலக அணுகல்',
  'auth.email': 'மின்னஞ்சல்',
  'auth.password': 'கடவுச்சொல்',
  'auth.signIn': 'உள்நுழை',
  'auth.signingIn': 'உள்நுழைகிறது…',
  'auth.mfaTitle': 'இரு-காரணி குறியீடு',
  'auth.mfaSubtitle': 'உங்கள் அங்கீகார செயலியில் உள்ள ஆறு இலக்கக் குறியீட்டை உள்ளிடவும்.',
  'auth.mfaCode': 'குறியீடு',
  'auth.mfaVerify': 'சரிபார்',
  'auth.mfaRequiredNote':
    'மேலாளர் மற்றும் அதற்கு மேலான கணக்குகளுக்கு இரு-காரணி அங்கீகாரம் அவசியம்.',
  'auth.forgotPassword': 'கடவுச்சொல் மறந்துவிட்டதா?',
  'auth.forgotPasswordHint':
    'அதை மீட்டமைக்க உங்கள் தொழிற்சாலை நிர்வாகியைக் கேட்கவும். கன்சோலால் மீட்டமைப்புத் தொடுப்பை மின்னஞ்சல் செய்ய முடியாது.',
  'auth.supplierWrongPlace': 'வழங்குநர்கள் கைபேசிச் செயலியில் உள்நுழைவார்கள், இங்கே அல்ல.',
  'auth.demoCredentials': 'மாதிரி உள்நுழைவு',
  'auth.demoMfa': '(இரு-காரணி: {{code}})',
  'auth.demoRole.clerk': 'எழுதுவினைஞர் — மாற்ற வேண்டுகோள்கள், வழங்குநர்கள்',
  'auth.demoRole.weigher': 'எடை பார்ப்பவர் — கொழுந்தைப் பதிவு செய்கிறார்',
  'auth.demoRole.accountant': 'கணக்கர் — விலை மற்றும் மாத நிறைவு',
  'auth.demoRole.manager': 'மேலாளர் — மாதத்தை வெளியிடுகிறார்',
  'auth.demoRole.editor': 'ஆசிரியர் — செய்திகளும் நிலையான பக்கங்களும் எழுதுகிறார்',
  'auth.demoRole.factoryAdmin': 'தொழிற்சாலை நிர்வாகி — உள்ளடக்கத்தை வெளியிடுகிறார்',
  'auth.sessionExpired': 'உங்கள் அமர்வு முடிந்தது. மீண்டும் உள்நுழையவும்.',

  /* ────────────────────────────── dashboard ────────────────────────────── */
  'dashboard.title': 'முகப்புப் பலகை',
  'dashboard.subtitle': 'ஒரு பார்வையில் இன்றைய நாள்',
  'dashboard.queues': 'வரிசைகள்',
  'dashboard.queueEmpty': 'காத்திருப்பது எதுவும் இல்லை',
  /* A queue the server reports that this version of the console has no screen for. Not
     "planned" — every module of the §18.1 scope is built; this is a newer API naming a
     queue this build has never heard of. */
  'dashboard.noScreenForQueue': 'இந்தப் பதிப்பில் இதற்கான திரை இல்லை',
  'dashboard.oldestWaiting': 'மிகப் பழையது {{age}}',
  'dashboard.slaBreaching': 'இலக்கைத் தாண்டியவை {{count}}',
  'dashboard.todaysCollection': 'இன்றைய கொழுந்து',
  'dashboard.todaysSuppliers': 'வழங்குநர்கள் {{count}}',
  'dashboard.todaysDeliveries': 'ஒப்படைப்புகள் {{count}}',
  'dashboard.vsYesterday': 'நேற்றுடன் ஒப்பிடுகையில் {{value}}',
  'dashboard.monthCycle': 'மாதச் சுழற்சி',
  'dashboard.openExceptions': 'தீர்க்கப்படாத சிக்கல்கள் {{count}}',
  'dashboard.noExceptions': 'தீர்க்கப்படாத சிக்கல்கள் இல்லை',
  'dashboard.intakeTrend': 'கொழுந்து வரவு, கடந்த 14 நாட்கள்',
  'dashboard.intakeAxisKg': 'கிலோ',
  'dashboard.alerts': 'கவனம் தேவை',
  'dashboard.noAlerts': 'கவனம் தேவைப்படுவது எதுவும் இல்லை',

  /* The §13 cycle stage is read by M1 and M3 alike, so it is not a dashboard
     label. Moved rather than duplicated: two tables for one enum drift. */
  'month.stage.collecting': 'கொழுந்து சேகரிக்கப்படுகிறது',
  'month.stage.awaitingRate': 'ஏல முடிவுக்குக் காத்திருக்கிறது',
  'month.stage.rateEntered': 'விலை உள்ளிடப்பட்டது',
  'month.stage.billsGenerated': 'பில்கள் உருவாக்கப்பட்டன',
  'month.stage.published': 'வெளியிடப்பட்டது',
  'dashboard.stageHint.awaitingRate':
    '{{month}} க்கு இன்னும் விலை இல்லை, எனவே விலையிலிருந்து கணக்கிடப்படும் ஒவ்வொரு மதிப்பும் பூஜ்யமாக அல்ல, வெறுமையாகக் காட்டப்படுகிறது.',
  'dashboard.stageHint.published': '{{name}} அவர்களால் {{date}} அன்று வெளியிடப்பட்டது.',

  'dashboard.queue.changeRequests': 'மாற்ற வேண்டுகோள்கள்',
  'dashboard.queue.advanceRequests': 'முன்பணங்கள்',
  'dashboard.queue.loanRequests': 'கடன்கள்',
  'dashboard.queue.manureRequests': 'உரம்',
  'dashboard.queue.inquiries': 'விசாரணைகள்',

  'dashboard.alert.missingBankDetails':
    'வழங்குநர்கள் {{count}} பேருக்கு ஒப்படைப்புகள் உள்ளன ஆனால் வங்கி விவரங்கள் இல்லை — ஒவ்வொன்றும் தீர்க்கப்படும் வரை மாதத்தை வெளியிட முடியாது.',
  'dashboard.alert.slaBreach': 'மாற்ற வேண்டுகோள்கள் {{count}} 3 நாட்களுக்கு மேல் காத்திருக்கின்றன.',
  'dashboard.alert.awaitingRate': '{{month}} க்கான ஏல முடிவு இன்னும் உள்ளிடப்படவில்லை.',

  /* ────────────────────────────── suppliers ────────────────────────────── */
  'suppliers.title': 'வழங்குநர்கள்',
  'suppliers.subtitle': 'பதிவேடு',
  'suppliers.searchPlaceholder': 'இலக்கம், பெயர் அல்லது தே.அ.அ. இலக்கத்தைத் தேடவும்',
  'suppliers.searchHint':
    'ஒரு இலக்கம் அதன் பிரிவுடன் அல்லது பிரிவின்றியும் பொருந்தும், எ.கா: 5708 அல்லது MAKADURA.',
  'suppliers.column.code': 'இலக்கம்',
  'suppliers.column.name': 'பெயர்',
  'suppliers.column.nic': 'தே.அ.அ. இலக்கம்',
  'suppliers.column.point': 'சேகரிப்பு நிலையம்',
  'suppliers.column.status': 'நிலை',
  'suppliers.column.payment': 'செலுத்தும் முறை',
  'suppliers.column.savings': 'சேமிப்பு /கிலோ',
  'suppliers.column.lastDelivery': 'இறுதி ஒப்படைப்பு',
  'suppliers.column.pending': 'நிலுவையில்',
  'suppliers.status.active': 'இயக்கத்தில்',
  'suppliers.status.suspended': 'இடைநிறுத்தப்பட்டது',
  'suppliers.status.closed': 'மூடப்பட்டது',
  'suppliers.payment.cheque': 'காசோலை',
  'suppliers.payment.bankTransfer': 'வங்கி மாற்றம்',
  'suppliers.payment.cash': 'பணம்',
  'suppliers.filter.allStatuses': 'எந்த நிலையும்',
  'suppliers.filter.allPoints': 'எந்தச் சேகரிப்பு நிலையமும்',
  'suppliers.filter.anyBankDetails': 'எந்த வங்கி விவரமும்',
  'suppliers.filter.noBankDetails': 'வங்கி விவரங்கள் இல்லை',
  'suppliers.noBankDetails': 'வங்கி விவரங்கள் இல்லை',
  'suppliers.optedOut': 'விலகியுள்ளார்',

  'suppliers.detail.profile': 'விவரங்கள்',
  'suppliers.detail.estate': 'தோட்டம்',
  'suppliers.detail.payout': 'கொடுப்பனவு',
  'suppliers.detail.savings': 'சேமிப்பு',
  'suppliers.detail.credit': 'கடன்',
  'suppliers.detail.activity': 'நடவடிக்கைகள்',
  'suppliers.detail.phone': 'தொலைபேசி',
  'suppliers.detail.email': 'மின்னஞ்சல்',
  'suppliers.detail.dateOfBirth': 'பிறந்த திகதி',
  'suppliers.detail.homeAddress': 'வீட்டு முகவரி',
  'suppliers.detail.estateAddress': 'தோட்ட முகவரி',
  'suppliers.detail.registered': 'பதிவு செய்த திகதி',
  'suppliers.detail.bank': 'வங்கி',
  'suppliers.detail.branch': 'கிளை',
  'suppliers.detail.accountNumber': 'கணக்கு இலக்கம்',
  'suppliers.detail.savingsRate': 'கிலோவுக்குச் சேமிப்பு',
  'suppliers.detail.savingsBalance': 'சேமிப்பு நிலுவை',
  'suppliers.detail.creditAdvance': 'முன்பண நிலுவை',
  'suppliers.detail.creditLoan': 'கடன் நிலுவை',
  'suppliers.detail.creditManure': 'உர நிலுவை',
  'suppliers.detail.pendingRequests': 'திறந்த வேண்டுகோள்கள்',
  'suppliers.detail.suspendedBecause': 'இடைநிறுத்தப்பட்டது: {{reason}}',
  'suppliers.detail.auditTitle': 'இந்தப் பதிவில் சமீபத்திய நடவடிக்கைகள்',

  'suppliers.action.edit': 'விவரங்களைத் திருத்து',
  'suppliers.action.suspend': 'இடைநிறுத்து',
  'suppliers.action.reactivate': 'மீண்டும் இயக்கு',
  'suppliers.action.reveal': 'முழு இலக்கத்தைக் காட்டு',
  'suppliers.action.resetPassword': 'செயலியின் கடவுச்சொல்லை மீட்டமை',

  'suppliers.reveal.title': 'முழு கணக்கு இலக்கத்தைக் காட்டு',
  'suppliers.reveal.body':
    'இது உங்கள் பெயருடனும் நீங்கள் தரும் காரணத்துடனும் தணிக்கைப் பதிவில் குறிக்கப்படும். ஏதாவது செய்வதற்கு அது தேவைப்படும்போது மட்டும் காட்டவும்.',
  'suppliers.reveal.reasonLabel': 'அது உங்களுக்கு ஏன் தேவை?',
  'suppliers.reveal.reasonPlaceholder':
    'எ.கா: ஜூலை கொடுப்பனவுச் சுற்றில் வங்கி நிராகரிப்பைச் சரிபார்ப்பது',
  'suppliers.reveal.show': 'இலக்கத்தைக் காட்டு',
  'suppliers.reveal.recorded': 'தணிக்கைப் பதிவில் {{auditId}} எனக் குறிக்கப்பட்டது.',

  'suppliers.suspend.title': '{{name}} ஐ இடைநிறுத்து',
  'suppliers.suspend.body':
    'இடைநிறுத்தப்பட்ட வழங்குநரின் ஒவ்வொரு பதிவும் எஞ்சியிருக்கும். மீண்டும் இயக்கும் வரை ஒப்படைப்புகளும் வேண்டுகோள்களும் நிற்கும்.',
  'suppliers.reactivate.title': '{{name}} ஐ மீண்டும் இயக்கு',
  'suppliers.reactivate.body': 'ஒப்படைப்புகளும் வேண்டுகோள்களும் உடனே மீண்டும் தொடங்கும்.',
  'suppliers.reasonLabel': 'காரணம் (தணிக்கைப் பதிவில் குறிக்கப்படும்)',

  'suppliers.resetPassword.title': 'செயலியின் கடவுச்சொல்லை மீட்டமை',
  'suppliers.resetPassword.pending':
    'அலுவலகம் வழங்குநரின் கடவுச்சொல்லை மீட்டமைக்கும் முறை — அவர்களின் அடையாளத்தை யார் சரிபார்க்கிறார், வழங்குநருக்கு என்ன கிடைக்கிறது — தொழிற்சாலையுடன் இன்னும் தீர்க்கப்படாத கேள்வி (§21.16). அது தீரும் வரை இந்தச் செயல் முடக்கப்பட்டுள்ளது.',

  /* ──────────────────────── M9 change requests ──────────────────────── */
  'changeRequests.title': 'மாற்ற வேண்டுகோள்கள்',
  'changeRequests.subtitle': 'கொடுப்பனவு மற்றும் சேமிப்பு வீத அனுமதிகள்',
  'changeRequests.column.supplier': 'வழங்குநர்',
  'changeRequests.column.type': 'மாற்றம்',
  'changeRequests.column.current': 'இப்போதுள்ளது',
  'changeRequests.column.requested': 'கேட்டது',
  'changeRequests.column.age': 'காத்திருந்த காலம்',
  'changeRequests.column.channel': 'கேட்டவர்',
  'changeRequests.type.bankDetails': 'வங்கி விவரங்கள்',
  'changeRequests.type.paymentMethod': 'செலுத்தும் முறை',
  'changeRequests.type.savingsRate': 'சேமிப்பு வீதம்',
  'changeRequests.status.pending': 'நிலுவையில்',
  'changeRequests.status.approved': 'அனுமதிக்கப்பட்டது',
  'changeRequests.status.rejected': 'நிராகரிக்கப்பட்டது',
  'changeRequests.channel.app': 'வழங்குநர் (செயலி)',
  'changeRequests.channel.office': 'அலுவலகம்',
  'changeRequests.filter.pending': 'நிலுவையில்',
  'changeRequests.filter.approved': 'அனுமதிக்கப்பட்டவை',
  'changeRequests.filter.rejected': 'நிராகரிக்கப்பட்டவை',
  'changeRequests.filter.allTypes': 'எந்த மாற்றமும்',
  'changeRequests.empty': 'வரிசை காலி',
  'changeRequests.emptyHint': 'ஒவ்வொரு மாற்ற வேண்டுகோளும் தீர்மானிக்கப்பட்டுவிட்டது.',

  'changeRequests.detail.title': 'மாற்ற வேண்டுகோள்',
  'changeRequests.detail.comparison': 'இப்போதுள்ளதும் கேட்டதும்',
  'changeRequests.detail.currentHeading': 'இப்போது இயக்கத்தில்',
  'changeRequests.detail.requestedHeading': 'கேட்டது',
  'changeRequests.detail.submitted': '{{when}} சமர்ப்பிக்கப்பட்டது',
  'changeRequests.detail.waiting': '{{age}} காத்திருக்கிறது',
  'changeRequests.detail.evidence': 'சான்றுகள்',
  'changeRequests.detail.addEvidence': 'கோப்பை இணைக்கவும்',
  'changeRequests.detail.noEvidence': 'கோப்புகள் இணைக்கப்படவில்லை',
  'changeRequests.detail.decision': 'தீர்மானம்',
  'changeRequests.detail.decidedBy': '{{name}} அவர்களால் {{when}} {{status}}',
  'changeRequests.detail.auditTitle': 'தணிக்கைத் தடம்',
  'changeRequests.detail.supplierLink': 'வழங்குநரின் பதிவைத் திற',

  'changeRequests.approve': 'அனுமதி',
  'changeRequests.reject': 'நிராகரி',
  'changeRequests.approveTitle': 'இந்த மாற்றத்தை அனுமதி',
  'changeRequests.rejectTitle': 'இந்த மாற்றத்தை நிராகரி',
  'changeRequests.approveBody':
    'வழங்குநரின் செயலி அடுத்த முறை புதுப்பிக்கும்போது புதிய மதிப்பைக் காட்டும், மேலும் இந்தத் தீர்மானம் உங்கள் பெயருடன் குறிக்கப்படும்.',
  'changeRequests.rejectBody':
    'இப்போதுள்ள மதிப்பு அப்படியே இருக்கும். வழங்குநர் உங்கள் குறிப்பையே காரணமாகப் படிப்பார், எனவே அதை அவர்களுக்காக எழுதுங்கள்.',
  'changeRequests.noteLabel': 'தீர்மானக் குறிப்பு',
  'changeRequests.notePlaceholderApprove':
    'எ.கா: கணக்குப் புத்தகம் தே.அ.அ. அட்டையுடன் ஒப்பிட்டுச் சரிபார்க்கப்பட்டது.',
  'changeRequests.notePlaceholderReject':
    'எ.கா: கணக்கின் பெயர் பதிவு செய்யப்பட்ட வழங்குநரின் பெயருடன் பொருந்தவில்லை. கணக்குப் புத்தகத்தை அலுவலகத்திற்குக் கொண்டு வரவும்.',
  'changeRequests.noteHelp': 'வழங்குநர் இதைப் படிப்பார். குறைந்தது 10 எழுத்துகள்.',
  'changeRequests.approved':
    'அனுமதிக்கப்பட்டது. செயலி அடுத்த முறை புதுப்பிக்கும்போது புதிய மதிப்பைக் காட்டும்.',
  'changeRequests.rejected': 'நிராகரிக்கப்பட்டது. இப்போதுள்ள மதிப்பு மாறவில்லை.',

  'changeRequests.fourEyes.title': 'இதை நீங்கள் தீர்மானிக்க முடியாது',
  'changeRequests.fourEyes.body':
    'இந்த வேண்டுகோளை வழங்குநருக்காக நீங்கள் சமர்ப்பித்ததால், அதை வேறு ஒருவர் தீர்மானிக்க வேண்டும். மேலாளரையோ வேறு எழுதுவினைஞரையோ கேட்கவும்.',
  'changeRequests.alreadyDecided.title': 'ஏற்கெனவே தீர்மானிக்கப்பட்டது',
  'changeRequests.alreadyDecided.body':
    'வரிசை திறந்திருந்தபோது வேறு ஒருவர் இதைத் தீர்மானித்துவிட்டார். அவர்கள் தேர்ந்தெடுத்ததைக் காட்ட மீண்டும் ஏற்றப்படுகிறது.',

  /* ─────────────────────── M7 Credit queues ─────────────────────── */
  'credit.title': 'கடன் வரிசைகள்',
  'credit.subtitle': 'முன்பணம், கடன் மற்றும் கடனுக்கு உரம்',
  'credit.column.supplier': 'வழங்குநர்',
  'credit.column.facility': 'வசதி',
  'credit.column.amount': 'கேட்ட தொகை',
  'credit.column.available': 'பெறக்கூடியது',
  'credit.column.age': 'காத்திருந்த காலம்',
  'credit.facility.advance': 'முன்பணம்',
  'credit.facility.loan': 'கடன்',
  'credit.facility.manure': 'உரம்',
  'credit.status.pending': 'நிலுவையில்',
  'credit.status.approved': 'அனுமதிக்கப்பட்டது',
  'credit.status.rejected': 'நிராகரிக்கப்பட்டது',
  'credit.filter.pending': 'நிலுவையில்',
  'credit.filter.approved': 'அனுமதிக்கப்பட்டவை',
  'credit.filter.rejected': 'நிராகரிக்கப்பட்டவை',
  'credit.filter.allFacilities': 'எந்த வசதியும்',
  'credit.filter.overCeiling': 'உச்ச வரம்பைத் தாண்டியவை மட்டும்',
  'credit.requested': 'கேட்ட தொகை',
  'credit.empty': 'வரிசை காலி',
  'credit.emptyHint': 'ஒவ்வொரு கடன் வேண்டுகோளும் தீர்மானிக்கப்பட்டுவிட்டது.',
  'credit.overCeilingShort': 'வரம்பைத் தாண்டியது',
  'credit.notEligibleShort': 'தகுதி இல்லை',

  'credit.eligibility.title': 'இந்த வழங்குநர் பெறக்கூடிய தொகை',
  'credit.eligibility.computedAt': '{{when}} கணக்கிடப்பட்டது',
  'credit.eligibility.eligible': 'தகுதி உண்டு',
  'credit.eligibility.notEligible': 'தகுதி இல்லை',
  'credit.eligibility.ceiling': 'உச்ச வரம்பு',
  'credit.eligibility.outstanding': 'ஏற்கெனவே பெற்றது',
  'credit.eligibility.available': 'இன்னும் பெறக்கூடியது',
  'credit.eligibility.withinCeiling': 'வரம்புக்கு உள்ளே',
  'credit.eligibility.overBy': '{{amount}} அளவுக்குத் தாண்டியுள்ளது',
  'credit.eligibility.blocked': 'ஏன் முடியாது:',
  'credit.eligibility.working': 'இது கணக்கிடப்பட்ட முறை',
  'credit.eligibility.monthsOfHistory': 'வருமானம் பெற்ற நிறைவு செய்யப்பட்ட மாதங்கள்',
  'credit.eligibility.historyOf': 'தேவையான {{required}}ல் {{count}}',
  'credit.eligibility.historyNotRequired': '{{count}} — முன்பணத்திற்குத் தேவையில்லை',
  'credit.eligibility.averageIncome': 'சராசரி மாதக் கணக்கு',
  'credit.eligibility.multiplier': 'கடன் மடங்கு',
  'credit.eligibility.lastSettledMonth': 'இறுதியாகத் தீர்க்கப்பட்ட மாதம்',
  'credit.eligibility.settledRate': 'அதை விலைமதிப்பிட்ட கிலோ விலை',
  'credit.eligibility.pricedKgs.advance': 'இந்த மாதம் இதுவரையான கொழுந்து',
  'credit.eligibility.pricedKgs.loan': 'விலைமதிப்பிடப்பட்ட கொழுந்து',
  'credit.eligibility.pricedKgs.manure': 'இறுதியாகத் தீர்க்கப்பட்ட மாதத்தின் கொழுந்து',

  /* The server names the blocker with a key; the copy lives here (BR-110). */
  'credit.reason.shortHistory':
    'இந்த வசதிக்குத் தேவையான அளவு வருமானம் பெற்ற நிறைவு மாதங்கள் வழங்குநருக்கு இன்னும் இல்லை.',
  'credit.reason.noSettledRate':
    'ஏல விலையுடன் இன்னும் எந்த மாதமும் தீர்க்கப்படவில்லை, எனவே வரம்பைக் கணக்கிட அடிப்படை எதுவும் இல்லை.',
  'credit.reason.noLeafThisMonth':
    'இந்த மாதம் கொழுந்து எதுவும் பதிவாகவில்லை, மேலும் முன்பணம் ஏற்கெனவே ஒப்படைத்த கொழுந்தின் அடிப்படையில் கணக்கிடப்படுகிறது.',
  'credit.reason.noCeiling': 'இந்த வழங்குநருக்கு விதி எந்த வரம்பையும் தருவதில்லை.',
  'credit.reason.fullyDrawn': 'இந்த வசதியின் முழு வரம்பையும் வழங்குநர் ஏற்கெனவே பெற்றுவிட்டார்.',

  'credit.detail.title': '{{facility}} · {{amount}}',
  'credit.detail.request': 'வேண்டுகோள்',
  'credit.detail.reason': 'வழங்குநர் கூறியது',
  'credit.detail.manureType': 'உரம்',
  'credit.detail.quantity': 'அளவு',
  'credit.detail.decision': 'தீர்மானம்',
  'credit.detail.decidedAgainst':
    '{{when}} கணக்கிடப்பட்ட {{ceiling}} வரம்பை அடிப்படையாகக் கொண்டு தீர்மானிக்கப்பட்டது.',
  'credit.detail.auditTitle': 'தணிக்கைத் தடம்',
  'credit.detail.otherRequests': 'அவர்களின் மற்ற திறந்த வேண்டுகோள்கள்',

  'credit.approve': 'அனுமதி',
  'credit.reject': 'நிராகரி',
  'credit.approveTitle': 'இந்தக் கடனை அனுமதி',
  'credit.rejectTitle': 'இந்த வேண்டுகோளை நிராகரி',
  'credit.approveBody':
    'வழங்குநர் {{amount}} பெறலாம், அது அவர்களின் {{facility}} நிலுவையில் சேர்க்கப்படும். அது அவர்களின் அடுத்த கணக்கில் கழிவாகத் திரும்பும்.',
  'credit.rejectBody':
    'எதுவும் செலுத்தப்படாது. வழங்குநர் உங்கள் குறிப்பையே காரணமாகப் படிப்பார், எனவே அதை அவர்களுக்காக எழுதுங்கள்.',
  'credit.noteLabel': 'தீர்மானக் குறிப்பு',
  'credit.noteHelp': 'வழங்குநர் இதைப் படிப்பார். குறைந்தது 10 எழுத்துகள்.',
  'credit.notePlaceholderApprove':
    'எ.கா: இந்த மாதம் ஏற்கெனவே எடை பார்க்கப்பட்ட கொழுந்துக்கு வரம்புக்கு உள்ளே. கவுண்டரில் செலுத்தப்படும்.',
  'credit.notePlaceholderReject':
    'எ.கா: சராசரி மாதக் கணக்கின் மூன்று மடங்குக்கு மேல். மேலும் இரு மாதங்கள் தீர்க்கப்பட்ட பின் மீண்டும் விண்ணப்பிக்கவும்.',
  'credit.approved': 'அனுமதிக்கப்பட்டது. அது அடுத்த கணக்கிலிருந்து கழிக்கப்படும்.',
  'credit.rejected': 'நிராகரிக்கப்பட்டது. எதுவும் செலுத்தப்படவில்லை.',

  'credit.managerDecides':
    'கடன் வேண்டுகோள்களைத் தீர்மானிப்பது மேலாளர். இதையும் இதற்குப் பின்னால் உள்ள அனைத்தையும் நீங்கள் படிக்கலாம், ஆனால் அனுமதி வழங்குவது உங்கள் வேலை அல்ல.',
  'credit.fourEyes.body':
    'இந்த வேண்டுகோளை வழங்குநருக்காக நீங்கள் சமர்ப்பித்ததால், அதை வேறு ஒருவர் தீர்மானிக்க வேண்டும். கடன் என்பது பணம், பணத்திற்கு நான்கு கண்கள் தேவை.',
  'credit.overCeiling.title': 'பெறக்கூடியதைவிட அதிகம்',
  'credit.overCeiling.body':
    'இது {{amount}} கேட்கிறது ஆனால் {{available}} மட்டுமே கிடைக்கும். இப்படியே இதை அனுமதிக்க முடியாது — நிராகரிக்கவும், அல்லது சிறிய வேண்டுகோள் ஒன்றைச் சமர்ப்பிக்க வழங்குநரிடம் கூறவும்.',
  'credit.stale.title': 'மதிப்புகள் மாறிவிட்டன',
  'credit.stale.body':
    'இது திறந்திருந்தபோது வரம்பு மாறியது — கொழுந்து பதிவாகியது, அல்லது ஒரு மாதம் வெளியிடப்பட்டது. புதிய மதிப்புகள் ஏற்றப்படுகின்றன; தீர்மானிப்பதற்கு முன் அவற்றைப் படிக்கவும்.',

  /* ─────────────────────────── M10 Inquiries ─────────────────────────── */
  'inquiries.title': 'விசாரணைகள்',
  'inquiries.subtitle': 'வழங்குநர்களிடமிருந்து வரும் செய்திகள்',
  'inquiries.searchPlaceholder': 'வழங்குநர், தலைப்பு அல்லது செய்தியைத் தேடவும்',
  'inquiries.column.subject': 'செய்தி',
  'inquiries.status.open': 'திறந்தது',
  'inquiries.status.resolved': 'பதில் அளிக்கப்பட்டது',
  'inquiries.status.closed': 'மூடப்பட்டது',
  'inquiries.filter.open': 'திறந்தவை',
  'inquiries.filter.resolved': 'பதில் அளிக்கப்பட்டவை',
  'inquiries.filter.closed': 'பதிலின்றி மூடப்பட்டவை',
  'inquiries.empty': 'காத்திருப்பது எதுவும் இல்லை',
  'inquiries.emptyHint': 'ஒவ்வொரு செய்திக்கும் பதில் அளிக்கப்பட்டு அல்லது மூடப்பட்டுவிட்டது.',

  'inquiries.detail.message': 'வழங்குநர் கேட்டது',
  'inquiries.detail.reply': 'பதில்',
  'inquiries.detail.repliedBy': '{{name}} அவர்களால் {{when}} பதில் அளிக்கப்பட்டது',
  'inquiries.detail.closed': 'பதிலின்றி மூடப்பட்டது',
  'inquiries.detail.closedBy': '{{name}} அவர்களால் {{when}} மூடப்பட்டது',
  'inquiries.detail.auditTitle': 'தணிக்கைத் தடம்',
  'inquiries.detail.history': 'அவர்களின் முந்தைய செய்திகள்',
  'inquiries.detail.pushSent':
    'பதில் ஒன்று உள்ளது என்று அறிவிக்கும் அறிவிப்பு அவர்களின் தொலைபேசிக்கு அனுப்பப்பட்டது — பதில் மட்டும் செயலியில்தான் உள்ளது, ஏனெனில் பூட்டுத் திரையைப் படிப்பவர் அதை கையில் வைத்திருப்பவர்.',
  'inquiries.detail.pushNotSent':
    'வழங்குநர் அடுத்த முறை செயலியைத் திறக்கும்போது இதைப் பார்ப்பார். பதில் அளிக்கப்பட்ட செய்திகளுக்கான தானியங்கி அறிவிப்புகள் இந்தத் தொழிற்சாலைக்கு முடக்கப்பட்டுள்ளன, எனவே அவர்களின் தொலைபேசிக்கு எதுவும் அனுப்பப்படவில்லை.',

  'inquiries.reply': 'பதில் அளி',
  'inquiries.sendReply': 'பதிலை அனுப்பு',
  'inquiries.close': 'பதிலின்றி மூடு',
  'inquiries.replyTitle': 'வழங்குநருக்குப் பதில் அளி',
  'inquiries.closeTitle': 'பதில் அளிக்காமல் மூடு',
  'inquiries.replyBody':
    'வழங்குநர் செயலியில் படிப்பது இதுவே. அவர்களைப் பற்றி அல்ல, அவர்களுக்கே எழுதுங்கள்.',
  'inquiries.closeBody':
    'நகல், சோதனைச் செய்தி, அல்லது வேறு இடத்திற்கானது ஒன்றுக்கு இதைப் பயன்படுத்தவும். வழங்குநருக்குப் பதில் அனுப்பப்படாது.',
  'inquiries.replyLabel': 'உங்கள் பதில்',
  'inquiries.replyHelp': 'வழங்குநர் இதைப் படிப்பார். குறைந்தது 20 எழுத்துகள்.',
  'inquiries.replyPlaceholder':
    'எ.கா: 12ஆம் திகதியைச் சரிபார்த்ததில் உள்ளிடப்படாத 96 கிலோவின் இரண்டாவது எடை பார்த்தல் கண்டறியப்பட்டது. அது இப்போது உங்கள் கணக்கில் உள்ளது.',
  'inquiries.closureNoteLabel': 'ஏன் மூடப்படுகிறது',
  'inquiries.closureNoteHelp': 'இதை அலுவலகம் மட்டுமே பார்க்கும். குறைந்தது 10 எழுத்துகள்.',
  'inquiries.closurePlaceholder': 'எ.கா: 4ஆம் திகதி பதில் அளிக்கப்பட்ட செய்தியின் நகல்.',
  'inquiries.replied':
    'பதில் அளிக்கப்பட்டது. வழங்குநர் அடுத்த முறை செயலியைத் திறக்கும்போது அதைப் பார்ப்பார்.',
  'inquiries.closed': 'மூடப்பட்டது. பதில் அனுப்பப்படவில்லை.',
  'inquiries.alreadyAnswered.title': 'ஏற்கெனவே பதில் அளிக்கப்பட்டது',
  'inquiries.alreadyAnswered.body':
    'இது திறந்திருந்தபோது வேறு ஒருவர் பதில் அளித்து அல்லது மூடிவிட்டார். அவர்கள் கூறியதைக் காட்ட மீண்டும் ஏற்றப்படுகிறது.',

  /* ─────────────────────────────── audit ─────────────────────────────── */
  'audit.title': 'தணிக்கைப் பதிவு',
  'audit.column.when': 'எப்போது',
  'audit.column.actor': 'யார்',
  'audit.column.action': 'செயல்',
  'audit.column.entity': 'பதிவு',
  'audit.column.change': 'மாற்றம்',
  'audit.filter.allEntities': 'எந்தப் பதிவு வகையும்',
  'audit.empty': 'இன்னும் எதுவும் குறிக்கப்படவில்லை',
  'audit.action.changeRequestApprove': 'மாற்ற வேண்டுகோள் ஒன்றை அனுமதித்தார்',
  'audit.action.changeRequestReject': 'மாற்ற வேண்டுகோள் ஒன்றை நிராகரித்தார்',
  'audit.action.supplierUpdate': 'வழங்குநர் ஒருவரைத் திருத்தினார்',
  'audit.action.supplierSuspend': 'வழங்குநர் ஒருவரை இடைநிறுத்தினார்',
  'audit.action.supplierReactivate': 'வழங்குநர் ஒருவரை மீண்டும் இயக்கினார்',
  'audit.action.supplierReveal': 'முழு கணக்கு இலக்கம் ஒன்றைப் பார்த்தார்',
  'audit.action.deliveryBatchCommit': 'எடை பார்க்கும் அமர்வு ஒன்றைப் பதிவு செய்தார்',
  'audit.action.deliveryVoid': 'ஒப்படைப்பு ஒன்றை இரத்துச் செய்தார்',
  'audit.action.rateSet': 'மாத விலை ஒன்றை உள்ளிட்டார்',
  'audit.action.monthExceptionResolve': 'மாத நிறைவுச் சிக்கல் ஒன்றைத் தீர்த்தார்',
  'audit.action.monthPublish': 'மாதம் ஒன்றை வெளியிட்டார்',
  'audit.action.billsGenerate': 'மாதம் ஒன்றின் பில்களை உருவாக்கினார்',
  'audit.action.payoutRunCreate': 'கொடுப்பனவுச் சுற்று ஒன்றைத் தயாரித்தார்',
  'audit.action.payoutRunApprove': 'கொடுப்பனவுச் சுற்று ஒன்றை விடுவித்தார்',
  'audit.action.payoutLinePaid': 'செலுத்தல் ஒன்றைப் பதிவு செய்தார்',
  'audit.action.payoutLineFailed': 'தோல்வியடைந்த செலுத்தல் ஒன்றைப் பதிவு செய்தார்',
  'audit.action.creditApprove': 'கடன் ஒன்றை அனுமதித்தார்',
  'audit.action.creditReject': 'கடன் வேண்டுகோள் ஒன்றை நிராகரித்தார்',
  'audit.action.inquiryReply': 'வழங்குநர் ஒருவருக்குப் பதில் அளித்தார்',
  'audit.action.inquiryClose': 'செய்தி ஒன்றைப் பதிலின்றி மூடினார்',

  'audit.action.newsCreate': 'செய்திக் கட்டுரை ஒன்றை உருவாக்கினார்',
  'audit.action.newsUpdate': 'செய்திக் கட்டுரை ஒன்றைத் திருத்தினார்',
  'audit.action.newsTranslationSave': 'மொழிபெயர்ப்பு ஒன்றைச் சேமித்தார்',
  'audit.action.newsPublish': 'செய்திக் கட்டுரை ஒன்றை வெளியிட்டார்',
  'audit.action.newsUnpublish': 'செய்திக் கட்டுரை ஒன்றை நீக்கினார்',
  'audit.action.newsArchive': 'செய்திக் கட்டுரை ஒன்றைக் காப்பகப்படுத்தினார்',
  'audit.action.staticPageSave': 'நிலையான பக்கம் ஒன்றைத் திருத்தினார்',
  'audit.action.staticPagePublish': 'நிலையான பக்கம் ஒன்றை வெளியிட்டார்',

  'audit.action.notificationSend': 'அறிவிப்பு ஒன்றை அனுப்பினார்',
  'audit.action.notificationTrigger': 'தானியங்கி அறிவிப்பு ஒன்றை மாற்றினார்',

  'audit.action.configUpdate': 'கட்டமைப்பை மாற்றினார்',
  'audit.action.userCreate': 'கன்சோல் பயனர் ஒருவரைச் சேர்த்தார்',
  'audit.action.userUpdate': 'பயனர் ஒருவரின் பெயரையோ பதவிகளையோ மாற்றினார்',
  'audit.action.userSuspend': 'கன்சோல் பயனர் ஒருவரை இடைநிறுத்தினார்',
  'audit.action.userReactivate': 'கன்சோல் பயனர் ஒருவரை மீண்டும் இயக்கினார்',
  'audit.action.userMfaReset': 'பயனர் ஒருவரின் இரு-காரணி உள்நுழைவை மீட்டமைத்தார்',
  'audit.action.roleUpdate': 'ஒரு பதவி செய்யக்கூடியதை மாற்றினார்',

  /* ───────────────────────────── validation ───────────────────────────── */
  'validation.required': 'இது அவசியம்',
  'validation.email': 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்',
  'validation.tooLong': 'அது மிக நீளமானது',
  'validation.min': 'மிகச் சிறியது',
  'validation.date': 'சரியான திகதியை உள்ளிடவும்',
  'validation.nic': 'சரியான தே.அ.அ. இலக்கத்தை உள்ளிடவும் (9 இலக்கங்களும் V, அல்லது 12 இலக்கங்கள்)',
  'validation.phone': 'சரியான இலங்கைத் தொலைபேசி இலக்கத்தை உள்ளிடவும்',
  'validation.supplierCode': '5708 அல்லது 5708 (MAKADURA) போன்ற இலக்கத்தை உள்ளிடவும்',
  'validation.monthKey': '2026-07 போன்ற மாதத்தை உள்ளிடவும்',
  'validation.ratePositive': 'விலை 0 ஐ விட அதிகமாக இருக்க வேண்டும்',
  'validation.rateNonNegative': 'இது எதிர்மறையாக இருக்க முடியாது',
  'validation.rateTooLarge': 'அந்த விலை தொழிற்சாலை பதிவு செய்யக்கூடியதை விடப் பெரியது',
  'validation.moneyScale': 'பணத்திற்கு அதிகபட்சம் இரண்டு தசம இடங்கள்',
  'validation.mfaCode': 'ஆறு இலக்கக் குறியீட்டை உள்ளிடவும்',
  'validation.noteRequired': 'குறிப்பு ஒன்று அவசியம்',
  'validation.noteTooShort': 'குறைந்தது 10 எழுத்துகள் எழுதுங்கள் — வழங்குநர் இதைப் படிப்பார்',
  'validation.url': 'சரியான வலை முகவரியை உள்ளிடவும்',
  'validation.fallbackRequired':
    'ஆங்கிலப் பாடம் அவசியம் — அனைத்தும் அதையே பின்வாங்கலாகக் கொள்கிறது',
  'validation.reasonRequired': 'காரணம் ஒன்று அவசியம்',
  'validation.replyRequired': 'பதில் ஒன்று அவசியம்',
  'validation.replyTooShort':
    'குறைந்தது 20 எழுத்துகள் எழுதுங்கள் — வழங்குநர் படிக்கும் பதில் இதுவே',

  /* ─────────────────────── M3 Leaf collection ─────────────────────── */
  'deliveries.title': 'கொழுந்து சேகரிப்பு',
  'deliveries.subtitle': 'தொழிற்சாலை நாளுக்கு நாள் எடை பார்த்த கொழுந்து',
  'deliveries.date': 'நாள்',
  'deliveries.point': 'சேகரிப்பு நிலையம்',
  'deliveries.allPoints': 'அனைத்துச் சேகரிப்பு நிலையங்கள்',
  'deliveries.showVoided': 'இரத்துச் செய்யப்பட்ட வரிசைகளைக் காட்டு',
  'deliveries.pickPointToEnter':
    'பதிவு செய்யத் தொடங்க ஒரு சேகரிப்பு நிலையத்தைத் தேர்ந்தெடுக்கவும் — ஒப்படைப்பு அது எடை பார்க்கப்பட்ட நிலையத்தின் கீழேயே பதியப்படுகிறது.',
  'deliveries.monthLocked':
    '{{month}} வெளியிடப்பட்டுவிட்டதால், அதில் மேலும் எதையும் பதிவு செய்யவோ இரத்துச் செய்யவோ முடியாது. பில்களும் கொடுப்பனவுகளும் கொழுந்து இப்போது உள்ளபடியே உருவாக்கப்படுகின்றன.',
  'deliveries.empty': 'இன்னும் எதுவும் எடை பார்க்கப்படவில்லை',
  'deliveries.emptyHint': 'எடை பார்க்கும் அமர்வு பதிவு செய்யப்பட்ட உடனேயே வரிசைகள் இங்கே தோன்றும்.',

  'deliveries.column.recordedAt': 'பதிவு செய்த நேரம்',
  'deliveries.column.supplier': 'வழங்குநர்',
  'deliveries.column.point': 'நிலையம்',
  'deliveries.column.kgs': 'கிலோ',
  'deliveries.column.source': 'மூலம்',
  'deliveries.column.recordedBy': 'எடை பார்த்தவர்',
  'deliveries.column.line': 'வரிசை',
  'deliveries.source.manual': 'கையால் உள்ளிடப்பட்டது',
  'deliveries.source.scaleFile': 'தராசுக் கோப்பு',

  'deliveries.totalKgs': 'மொத்தக் கிலோ',
  'deliveries.rowCount': 'ஒப்படைப்புகள்',
  'deliveries.supplierCount': 'வழங்குநர்கள்',

  'deliveries.supplierCode': 'வழங்குநரின் இலக்கம்',
  'deliveries.supplierCodeHint': 'பிரிவுடன் அல்லது பிரிவின்றி, எ.கா: 5708 அல்லது 5708 (MAKADURA).',
  'deliveries.supplierCodePlaceholder': 'இலக்கம், பின்னர் Tab',
  'deliveries.kgs': 'கிலோ',
  'deliveries.addRow': 'வரிசை ஒன்றைச் சேர்',
  'deliveries.removeRow': 'நீக்கு',
  'deliveries.sessionEmpty':
    'வழங்குநரின் இலக்கத்தையும் கிலோவையும் தட்டச்சு செய்து Enter அழுத்தவும். நீங்கள் பதிவு செய்யும் வரை எதுவும் சேமிக்கப்படாது.',
  'deliveries.sessionTable': 'இந்த எடை பார்க்கும் அமர்வின் வரிசைகள், இன்னும் பதிவு செய்யப்படவில்லை',
  'deliveries.commit': 'வரிசைகள் {{count}} ஐப் பதிவு செய்',
  'deliveries.committed': 'ஒப்படைப்புகள் {{count}} பதிவு செய்யப்பட்டன',
  'deliveries.committedTotal': 'இன்றைய மொத்தம் இப்போது {{kgs}}.',
  'deliveries.committedPartly': '{{accepted}} பதிவு செய்யப்பட்டது, {{rejected}} மறுக்கப்பட்டது',
  'deliveries.committedPartlyHint':
    'மறுக்கப்பட்ட வரிசைகள் ஒவ்வொன்றின் காரணத்துடன் இன்னும் அட்டவணையில் உள்ளன. அவற்றைச் சரிசெய்து மீண்டும் பதிவு செய்யவும்.',
  'deliveries.commitFailed': 'எதுவும் பதிவு செய்யப்படவில்லை',
  'deliveries.outlierConfirm':
    'இந்த அமர்வின் மற்றவற்றை விட {{kgs}} மிக அதிகம். அது தட்டச்சு செய்தபடியே பதிவு செய்ய மீண்டும் Enter அழுத்தவும்.',

  'deliveries.error.sessionFull':
    'ஒரு அமர்வில் அதிகபட்சம் {{limit}} வரிசைகள். இவற்றைப் பதிவு செய்து, பின்னர் மற்றொன்றைத் தொடங்கவும்.',
  'deliveries.error.stillMatching': 'அந்த இலக்கம் இன்னும் தேடப்படுகிறது…',
  'deliveries.error.unknownSupplier': 'அந்த இலக்கத்துடன் இயக்கத்தில் உள்ள வழங்குநர் இல்லை.',
  'deliveries.error.kgRange': 'கிலோ 0 ஐ விட அதிகமாகவும் அதிகபட்சம் {{max}} ஆகவும் இருக்க வேண்டும்.',
  'deliveries.error.kgPrecision':
    'கிலோவுக்கு அதிகபட்சம் இரண்டு தசம இடங்கள் — தொழிற்சாலை 12.35 ஐப் பதிவு செய்கிறது, 12.345 அல்ல.',

  'deliveries.void': 'இரத்து',
  'deliveries.voidedBadge': 'இரத்துச் செய்யப்பட்டது',
  'deliveries.voidTitle': 'இந்த ஒப்படைப்பை இரத்துச் செய்',
  'deliveries.voidDescription':
    '{{code}} · {{name}} க்கு {{kgs}} பதிவு செய்யப்பட்டது. உங்கள் காரணத்துடன் வரிசை பதிவில் எஞ்சியிருக்கும் — பணம் சார்ந்த எதுவும் அழிக்கப்படுவதில்லை.',
  'deliveries.voidConfirm': 'ஒப்படைப்பை இரத்துச் செய்',
  'deliveries.voidReasonHint':
    'குறைந்தது {{min}} எழுத்துகள். இந்த எடை பார்த்தலுக்கான சீட்டு வழங்குநரிடம் உள்ளது, அவர் கேட்கக்கூடும்.',
  'deliveries.voided': '{{kgs}} இரத்துச் செய்யப்பட்டது',
  'deliveries.voidFailed': 'ஒப்படைப்பு இரத்துச் செய்யப்படவில்லை',

  /* ─────────────────── M4 Rates & month close ─────────────────── */
  'months.title': 'விலை மற்றும் மாத நிறைவு',
  'months.subtitle': 'ஏல விலை, மற்றும் மாதம் நிறைவடைவதைத் தடுப்பது எது',
  'months.pickMonth': 'மாதம்',
  'months.totalKgs': 'இந்த மாதக் கொழுந்து',
  'months.suppliers': 'வழங்குநர்கள்',
  'months.perKg': 'கிலோவுக்கு',

  'months.rateTitle': 'ஏல விலை',
  'months.rateDescription': 'இந்த மாதத்திற்கு ஒரு கிலோவுக்குத் தொழிற்சாலை செலுத்துவது.',
  'months.ratePerKg': 'கிலோவுக்கு விலை',
  'months.ratePerKgHint': 'ஏல முடிவிலிருந்து.',
  'months.extraRatePerKg': 'கிலோவுக்கு மேலதிகம்',
  'months.extraHint': 'தொழிற்சாலை மேலதிகமாகச் சேர்ப்பது. 0 என்பதும் ஒரு உண்மையான பதில்.',
  'months.totalPerKg': 'கிலோவுக்கு மொத்தம்',
  'months.saveRate': 'விலையைச் சேமி',
  'months.updateRate': 'விலையைத் திருத்து',
  'months.enteredBy': 'உள்ளிட்டவர்',
  'months.noRateYet':
    '{{month}} க்கு இன்னும் விலை உள்ளிடப்படவில்லை, எனவே செயலியில் விலையிலிருந்து கணக்கிடப்படும் ஒவ்வொரு மதிப்பும் பூஜ்யமாக அல்ல, வெறுமையாகக் காட்டப்படுகிறது.',
  'months.rateLocked':
    'இந்த மாதம் வெளியிடப்பட்டுவிட்டதால், விலை பதிவின் பகுதியாகிவிட்டது, அதை மாற்ற முடியாது.',
  'months.rateReadOnly': 'விலையை உள்ளிடுவது கணக்கர் மட்டுமே.',
  'months.rateSaved': '{{month}} க்கான விலை சேமிக்கப்பட்டது',
  'months.rateFailed': 'விலை சேமிக்கப்படவில்லை',

  'months.error.ratePositive': 'விலை 0 ஐ விட அதிகமாக இருக்க வேண்டும்.',
  'months.error.extraNonNegative': 'மேலதிகம் எதிர்மறையாக இருக்க முடியாது.',
  'months.error.moneyScale': 'பணத்திற்கு அதிகபட்சம் இரண்டு தசம இடங்கள்.',

  'months.closeTitle': 'மாத நிறைவு',
  'months.closeDescription': 'மாதத்தை வெளியிடுவதற்கு முன் ஒவ்வொரு படியும் நிறைவு பெற வேண்டும்.',
  'months.closedDescription': 'இந்த மாதம் நிறைவு பெற்றுவிட்டது. அதன் மதிப்புகளே இப்போது பதிவு.',
  'months.step.leaf': 'கொழுந்து பதிவு செய்யப்பட்டது',
  'months.step.leafDetail':
    'வழங்குநர்கள் {{suppliers}} பேரிடமிருந்து {{kgs}}, ஒப்படைப்புகள் {{deliveries}}.',
  'months.step.rate': 'ஏல விலை உள்ளிடப்பட்டது',
  'months.step.rateDetail': 'கிலோவுக்கு {{total}}, {{name}} அவர்களால் உள்ளிடப்பட்டது.',
  'months.step.rateMissing': 'இன்னும் விலை இல்லை — அது இல்லாமல் பில்களை உருவாக்க முடியாது.',
  'months.step.exceptions': 'சிக்கல்கள் தீர்க்கப்பட்டன',
  'months.step.exceptionsClear': 'அனைத்து {{total}} தீர்க்கப்பட்டன.',
  'months.step.exceptionsOpen': '{{count}} இன்னும் தீரவில்லை.',
  'months.step.bills': 'பில்கள் உருவாக்கப்பட்டன',
  'months.step.billsDetail': 'பில்கள் {{count}}, செலுத்த வேண்டியது {{payable}}.',
  'months.step.billsMissing':
    'இன்னும் பில்கள் உருவாக்கப்படவில்லை — வழங்குநர்களுக்குக் கொடுக்க வெளியீட்டில் எதுவும் இல்லை.',
  'months.step.billsStale':
    'பில்கள் உருவாக்கப்பட்ட பின் கொழுந்து மாறியுள்ளது. நிறைவு செய்வதற்கு முன் அவற்றை மீண்டும் உருவாக்கவும்.',
  'months.step.openBills': 'பில் சுற்றைத் திற',
  'months.stepDone': '— முடிந்தது',
  'months.stepBlocked': '— இன்னும் முடியவில்லை',
  'months.publish': '{{month}} ஐ வெளியிடு',
  'months.blockedHint': 'முதலில் மேலே உள்ள படிகளை முடிக்கவும்.',
  'months.irreversibleHint':
    'வெளியீட்டை மீளச் செய்ய முடியாது: கொழுந்து பூட்டப்படும், மேலும் பில்களும் கொடுப்பனவுகளும் இந்த மதிப்புகளிலிருந்தே உருவாக்கப்படும்.',
  'months.fourEyesHint':
    'இந்த மாதத்தின் விலையை நீங்கள் உள்ளிட்டதால், அதை வேறு ஒருவர் வெளியிட வேண்டும் (BR-501).',
  'months.publishNeedsManager': 'மாதம் ஒன்றை வெளியிடுவது மேலாளரின் தீர்மானம்.',
  'months.alreadyPublished': '{{name}} அவர்களால் {{date}} அன்று வெளியிடப்பட்டது.',
  'months.confirmTitle': '{{month}} ஐ வெளியிடவா?',
  'months.confirmDescription':
    'இதை மீளச் செய்ய முடியாது. மாதத்தின் கொழுந்து மேலும் உள்ளிடுவதற்கு எதிராகப் பூட்டப்படும், மேலும் ஒவ்வொரு பில்லும் கொடுப்பனவும் கீழே உள்ள மதிப்புகளிலிருந்தே உருவாக்கப்படும்.',
  'months.confirmPublish': 'மாதத்தை வெளியிடு',
  'months.publishNoteHint':
    'அவசியமில்லை. இந்த நிறைவு பற்றி அலுவலகம் அறிய வேண்டியது எதுவும் இருந்தால்.',
  'months.published': '{{month}} வெளியிடப்பட்டது',
  'months.publishFailed': 'மாதம் வெளியிடப்படவில்லை',

  'months.exceptionsTitle': 'சிக்கல்கள்',
  'months.exceptionsDescription':
    'நிறைவுக்கு முன் ஒவ்வொன்றும் தீர்க்கப்பட வேண்டும், அல்லது விளக்கப்பட வேண்டும்.',
  'months.filterExceptions': 'எந்தச் சிக்கல்கள்',
  'months.filter.open': 'தீரவில்லை ({{count}})',
  'months.filter.resolved': 'தீர்க்கப்பட்டவை',
  'months.filter.all': 'அனைத்தும்',
  'months.column.type': 'சிக்கல்',
  'months.column.supplier': 'வழங்குநர்',
  'months.column.detail': 'விவரம்',
  'months.column.raised': 'எழுப்பப்பட்டது',
  'months.exception.missingBankDetails': 'வங்கி விவரங்கள் இல்லை',
  'months.exception.inactiveSupplierWithLeaf': 'இயக்கத்தில் இல்லாத வழங்குநரிடமிருந்து கொழுந்து',
  'months.exception.pendingChangeRequest': 'மாற்ற வேண்டுகோள் இன்னும் திறந்திருக்கிறது',
  'months.exception.outlierDelivery': 'வழக்கத்திற்கு மாறான எடை பார்த்தல்',
  'months.openRecord': 'பதிவைத் திற',
  'months.resolve': 'தீர்',
  'months.resolveTitle': 'இந்தச் சிக்கலைத் தீர்',
  'months.resolveConfirm': 'தீர்க்கப்பட்டதாகக் குறி',
  'months.resolveNoteHint':
    'குறைந்தது {{min}} எழுத்துகள். இது இருக்கும்போதே மாதம் ஏன் நிறைவு பெற்றது என்று தணிக்கையாளர் கேட்கும்போது அவர் படிப்பது இதுவே.',
  'months.resolvedByNote': '{{name}} தீர்த்தார்: {{note}}',
  'months.exceptionResolved': 'சிக்கல் தீர்க்கப்பட்டது',
  'months.exceptionResolveFailed': 'சிக்கல் தீர்க்கப்படவில்லை',
  'months.noOpenExceptions': 'நிறைவைத் தடுப்பது எதுவும் இல்லை',
  'months.noOpenExceptionsHint':
    'இந்த மாதத்திற்கு எழுப்பப்பட்ட ஒவ்வொரு சிக்கலும் தீர்க்கப்பட்டுவிட்டது.',

  /* ─────────── shared by the money modules (M5, M6, M8) ─────────── */
  'money.pickMonth': 'மாதம்',

  /* ───────────────────────────── M5 Bills ───────────────────────────── */
  'bills.title': 'பில்கள்',
  'bills.subtitle': 'கொழுந்து கணக்குகள், மாதம் வெளியிடப்படும் முன் சரிபார்க்கப்படுகின்றன',
  'bills.searchPlaceholder': 'இலக்கம், பெயர் அல்லது பில் இலக்கத்தைத் தேடவும்',
  'bills.lensLabel': 'காட்டு',
  'bills.lens.all': 'அனைத்துப் பில்கள்',
  'bills.lens.missingBankDetails': 'செலுத்த வேண்டியது, வங்கி விவரங்கள் இல்லை',
  'bills.lens.carriesDebt': 'செலுத்த வேண்டியது எதுவும் இல்லை',
  'bills.payableLabel': 'செலுத்த வேண்டியது',
  'bills.empty': 'இந்த மாதத்திற்குப் பில்கள் இல்லை',
  'bills.emptyHint': 'ஏல விலை உள்ளிடப்பட்ட பின் சுற்றை உருவாக்கவும்.',

  'bills.column.supplier': 'வழங்குநர்',
  'bills.column.billNo': 'பில் இல.',
  'bills.column.kgs': 'கிலோ',
  'bills.column.gross': 'மொத்தம் (ரூ.)',
  'bills.column.deductions': 'கழிவுகள் (ரூ.)',
  'bills.column.payable': 'செலுத்த வேண்டியது (ரூ.)',
  'bills.flag.unbalanced': 'கூட்டுத்தொகை பொருந்தவில்லை',
  'bills.flag.noBank': 'வங்கி விவரங்கள் இல்லை',
  'bills.flag.carriesDebt': 'கடன் சுமக்கிறது',

  'bills.runTitle': 'பில் சுற்று',
  'bills.runDescription':
    'பில் ஒன்று மாதத்தின் கொழுந்திலிருந்தும் அதன் விலையிலிருந்தும் கணக்கிடப்படுகிறது. அவற்றில் ஏதேனும் மாறும்போதெல்லாம் மீண்டும் உருவாக்கவும்.',
  'bills.runDescriptionClosed':
    'இந்தப் பில்களே பதிவு. வழங்குநர்கள் அவற்றைச் செயலியில் பார்க்கலாம்.',
  'bills.runBills': 'பில்கள்',
  'bills.runKgs': 'பில் போடப்பட்ட கொழுந்து',
  'bills.runGross': 'மொத்தம்',
  'bills.runDeductions': 'கழிவுகள்',
  'bills.runSavings': 'வைத்திருக்கும் சேமிப்பு',
  'bills.runCarryingDebt': 'செலுத்த வேண்டியது எதுவும் இல்லை',
  'bills.runGeneratedBy': '{{name}} அவர்களால் {{when}} உருவாக்கப்பட்டது.',
  'bills.notGenerated':
    '{{month}} க்கு இன்னும் பில்கள் உருவாக்கப்படவில்லை. முதலில் ஏல விலை உள்ளிடப்பட வேண்டும்.',
  'bills.generate': 'பில்களை உருவாக்கு',
  'bills.generateHint':
    'இந்த மாதம் கொழுந்து கொண்டு வந்த ஒவ்வொரு வழங்குநருக்கும் ஒரு கொழுந்து கணக்கை உருவாக்குகிறது. மாதம் வெளியிடப்படும் வரை வழங்குநர்களுக்கு எதுவும் அனுப்பப்படாது.',
  'bills.regenerate': 'பில்களை மீண்டும் உருவாக்கு',
  'bills.regenerateHint':
    'கொழுந்தும் விலையும் இப்போது உள்ளபடியே ஒவ்வொரு பில்லையும் மீண்டும் கணக்கிடுகிறது. மாதம் திறந்திருக்கும் வரை இதைத் திரும்பத் திரும்பச் செய்வது பாதுகாப்பானது.',
  'bills.generateReadOnly': 'பில்களை உருவாக்குவது கணக்கர் மட்டுமே.',
  'bills.generated': '{{month}} க்கான பில்கள் உருவாக்கப்பட்டன',
  'bills.generatedDetail': 'பில்கள் {{count}}, செலுத்த வேண்டியது {{payable}}.',
  'bills.generateFailed': 'பில்கள் உருவாக்கப்படவில்லை',
  'bills.missingBankWarning':
    'வழங்குநர்கள் {{count}} பேருக்குப் பணம் செலுத்த வேண்டியுள்ளது ஆனால் கோப்பில் வங்கி விவரங்கள் இல்லை. கணக்குப் புத்தகம் பெறப்படும் வரை கொடுப்பனவுச் சுற்று அந்த வரிசைகளை நிறுத்தி வைக்கும்.',
  'bills.staleWarning':
    'இந்தப் பில்கள் உருவாக்கப்பட்ட பின் கொழுந்து மாறியுள்ளது (அப்போது {{kgs}}). வெளியிடுவதற்கு முன் மீண்டும் உருவாக்கவும் — இப்போது பொருந்தாத மதிப்புகளின் மேல் மாதம் நிறைவு பெற முடியாது.',
  'bills.publishedLock':
    'இந்த மாதம் வெளியிடப்பட்டுவிட்டதால், அதன் பில்களே பதிவு, அவற்றை மீண்டும் உருவாக்க முடியாது.',

  'bills.detailTitle': 'கொழுந்து கணக்கு · {{code}}',
  'bills.detailSubtitle': '{{name}} · {{month}}',
  'bills.backToMonth': '{{month}} க்குத் திரும்பு',
  'bills.published': 'வெளியிடப்பட்டது',
  'bills.draft': 'இன்னும் வெளியிடப்படவில்லை',
  'bills.slipHeader': 'கணக்கு',
  'bills.billNo': 'பில் இலக்கம்',
  'bills.month': 'மாதம்',
  'bills.supplier': 'வழங்குநர்',
  'bills.issued': 'உருவாக்கப்பட்டது',
  'bills.factoryRegNo': 'தொழிற்சாலைப் பதிவு இல.',
  'bills.earnings': 'கொழுந்தும் விலையும',
  'bills.noAuctionResult':
    'இந்த மாதத்திற்கு ஏல முடிவு இல்லை, எனவே விலையிலிருந்து கணக்கிடப்படும் ஒவ்வொரு மதிப்பும் பூஜ்யமாக அல்ல, வெறுமையாகக் காட்டப்படுகிறது.',
  'bills.totalKgs': 'மொத்தக் கிலோ',
  'bills.greenLeafAmount': 'கொழுந்துத் தொகை',
  'bills.extraPayment': 'மேலதிகச் செலுத்தல்',
  'bills.grossAmount': 'மொத்தத் தொகை',

  'bills.deductions': 'கழிவுகள்',
  'bills.deductionsPolicy':
    'அச்சிடப்பட்ட கணக்கு சுமக்கும் ஒன்பது வரிசைகள். இவற்றில் எவற்றை வழங்குநருக்கு ஏற்ப அலுவலகம் அமைக்கலாம் என்பது தொழிற்சாலையுடன் இன்னும் தீர்க்கப்படாத கேள்வி (§21.10), எனவே இங்கே எதையும் திருத்த முடியாது.',
  'bills.deductionsTotal': 'மொத்தக் கழிவுகள்',
  'bills.deduction.transportCharges': 'போக்குவரத்துக் கட்டணம்',
  'bills.deduction.tea': 'வழங்கப்பட்ட தேயிலை',
  'bills.deduction.savings': 'சேமிப்பு',
  'bills.deduction.loansAdvance': 'கடன் திருப்பிச் செலுத்தல்',
  'bills.deduction.advance': 'முன்பணம்',
  'bills.deduction.manure': 'உரம்',
  'bills.deduction.otherCards': 'மற்ற அட்டைகள்',
  'bills.deduction.stamps': 'முத்திரைகள்',
  'bills.deduction.previousDebts': 'முந்தைய கடன்கள்',
  'bills.unbalancedWarning':
    'இந்தப் பில்லின் கழிவு வரிசைகள் அதில் குறிக்கப்பட்ட மொத்தத்துடன் பொருந்தவில்லை (BR-107). இந்த மாதத்தை வெளியிட வேண்டாம் — தொழிற்சாலை நிர்வாகிக்குத் தெரிவிக்கவும்.',

  'bills.balance': 'நிலுவை',
  'bills.balanceDescription':
    'தொழிற்சாலை முழு ரூபாயையே செலுத்துகிறது. சதங்கள் அடுத்த மாதத்திற்கு எடுத்துச் செல்லப்படும்.',
  'bills.balanceAmount': 'நிலுவைத் தொகை',
  'bills.coinsBroughtForward': 'முன்னிருந்து வந்த சதங்கள்',
  'bills.coinsCarriedForward': 'அடுத்ததற்கு எடுத்துச் செல்லும் சதங்கள்',
  'bills.finalBalance': 'இறுதி நிலுவை',
  'bills.carriesDebtNotice':
    'கழிவுகள் இந்த மாதக் கணக்கை விட அதிகமாகிவிட்டன. செலுத்த வேண்டியது எதுவும் இல்லை, மேலும் {{amount}} அடுத்த மாதத்திற்கு எடுத்துச் செல்லப்படுகிறது.',
  'bills.noBankNotice':
    'இந்த வழங்குநருக்குப் பணம் செலுத்த வேண்டியுள்ளது ஆனால் கோப்பில் வங்கி விவரங்கள் இல்லை. கொடுப்பனவுச் சுற்று இந்த வரிசையை நிறுத்தி வைக்கும்.',

  'bills.carryForward': 'அடுத்த மாதத்திற்கு எடுத்துச் செல்லப்பட்டது',
  'bills.nextMonthDeb': 'எடுத்துச் செல்லப்பட்ட கடன்',
  'bills.advanceBalance': 'முன்பண நிலுவை',
  'bills.manureBalance': 'உர நிலுவை',
  'bills.loanInterest': 'கடன் வட்டி',

  'bills.savingsDescription':
    'வழங்குநரின் அனுமதிக்கப்பட்ட வீதத்தில் கழிக்கப்பட்டு தொழிற்சாலையால் வைத்திருக்கப்படுகிறது.',
  'bills.savingsThisMonth': 'இந்த மாதம்',
  'bills.savingsPrevious': 'முந்தைய நிலுவை',
  'bills.savingsToDate': 'இன்றுவரையான நிலுவை',
  'bills.openPassbook': 'சேமிப்புப் புத்தகத்தைத் திற',

  'bills.dailySupply': 'அன்றாட வழங்கல்',
  'bills.dailySupplyDetail': '{{days}} நாட்களில் கொழுந்து, மொத்தம் {{kgs}}.',

  'bills.correctionsDraft':
    'மாதம் வெளியிடப்படும் வரை இங்குள்ள எதுவும் வழங்குநருக்கு அனுப்பப்படாது. அதுவரை, தவறான மதிப்பை அதன் மூலத்திலேயே சரிசெய்யவும் — கொழுந்து சேகரிப்பில் ஒரு ஒப்படைப்பு, அல்லது விலை மற்றும் மாத நிறைவில் விலை — பின்னர் மீண்டும் உருவாக்கவும்.',
  'bills.correctionsPublished':
    'இந்தப் பில் வெளியிடப்பட்டுவிட்டதால், இதுவே பதிவு. வெளியிடப்பட்ட பில்லைத் திருத்தலாமா, அல்லது தவறு எப்போதும் அடுத்த கணக்கில் சரிசெய்யப்படுமா என்பது தொழிற்சாலையுடன் இன்னும் தீர்க்கப்படாத கேள்வி (§21.8).',

  /* ───────────────────────────── M6 Payouts ───────────────────────────── */
  'payouts.title': 'கொடுப்பனவுகள்',
  'payouts.subtitle': 'வெளியிடப்பட்ட மாதத்திற்குச் செலுத்துவது, ஒரு முறையாக ஒன்று',
  'payouts.monthTotal': 'செலுத்த வேண்டியது',
  'payouts.monthPaid': 'செலுத்தப்பட்டது',
  'payouts.empty': 'இந்த மாதத்திற்குக் கொடுப்பனவுச் சுற்றுகள் இல்லை',
  'payouts.emptyHint': 'மாதம் வெளியிடப்பட்ட பின் ஒன்றைத் தயாரிக்கவும்.',

  'payouts.column.method': 'முறை',
  'payouts.column.total': 'மொத்தம்',
  'payouts.column.progress': 'செலுத்தப்பட்டது',
  'payouts.column.prepared': 'தயாரித்தவர்',
  'payouts.column.released': 'விடுவித்தவர்',
  'payouts.column.supplier': 'வழங்குநர்',
  'payouts.column.amount': 'தொகை',
  'payouts.column.account': 'கணக்கு',
  'payouts.progress': 'மொத்தம் {{total}}ல் {{paid}}',
  'payouts.awaitingApproval': 'மேலாளருக்குக் காத்திருக்கிறது',
  'payouts.status.draft': 'வரைவு',
  'payouts.status.approved': 'விடுவிக்கப்பட்டது',
  'payouts.status.completed': 'நிறைவு பெற்றது',
  'payouts.heldCount': '{{count}} நிறுத்தி வைக்கப்பட்டது',
  'payouts.failedCount': '{{count}} தோல்வியடைந்தது',

  'payouts.prepareTitle': 'சுற்று ஒன்றைத் தயாரி',
  'payouts.prepareDescription':
    'ஒரு செலுத்தும் முறைக்கு ஒரு சுற்று: வங்கிக் கோப்பு, காசோலைப் பட்டியல், பணத் தாள் என்பன மூன்று வேறுபட்ட வேலைகள்.',
  'payouts.method': 'செலுத்தும் முறை',
  'payouts.prepare': 'சுற்றைத் தயாரி',
  'payouts.prepareHint':
    'இந்த முறையில் பணம் பெற வேண்டிய ஒவ்வொரு வழங்குநருக்கும் ஒரு வரிசையை உருவாக்குகிறது. மேலாளர் விடுவிக்கும் வரை எதுவும் செலுத்தப்படாது.',
  'payouts.prepareReadOnly': 'கொடுப்பனவுச் சுற்றைத் தயாரிப்பது கணக்கர் மட்டுமே.',
  'payouts.prepared': '{{method}} சுற்று தயாரிக்கப்பட்டது',
  'payouts.preparedDetail': 'செலுத்த வேண்டியவை {{lines}}, நிறுத்தி வைக்கப்பட்டவை {{held}}.',
  'payouts.prepareFailed': 'சுற்று தயாரிக்கப்படவில்லை',
  'payouts.notPublished':
    '{{month}} இன்னும் வெளியிடப்படவில்லை. கொடுப்பனவுச் சுற்றுக்கு நிறைவு பெற்ற மாதம் தேவை — அதுவரை மதிப்புகள் மாறக்கூடும், மேலும் தொழிற்சாலையை விட்டுச் சென்ற பணத்தைத் திரும்பப் பெற முடியாது.',
  'payouts.noBills':
    '{{month}} க்குப் பில்கள் எதுவும் உருவாக்கப்படவில்லை, எனவே எதற்கு எதிராகச் செலுத்துவதற்கும் எதுவும் இல்லை.',
  'payouts.allMethodsPrepared':
    'இந்த மாதத்திற்கு ஒவ்வொரு செலுத்தும் முறைக்கும் ஏற்கெனவே ஒரு சுற்று உள்ளது.',
  'payouts.noFileExport':
    'ஒரு சுற்று வெளியிடப்பட்டவுடன், அமைவு → கொடுப்பனவுக் கோப்பு கூறும் அமைப்பில் அதைக் கோப்பாகப் பதிவிறக்கலாம். இன்னும் திறந்திருப்பது (§21.17) கட்டுப்பாட்டுக் கூட்டுத்தொகைகளுடன் கூடிய நிலையான-அகல வங்கி வடிவம், மற்றும் முன்-அச்சிடப்பட்ட தாள்களில் காசோலை அச்சிடல் — இரண்டுக்கும் உங்கள் வங்கியின் சொந்த விவரக்குறிப்பு தேவை.',

  'payouts.downloadFile': 'கோப்பைப் பதிவிறக்கு',
  'payouts.fileHint':
    'இந்தச் சுற்றின் விரிதாள், அமைவு → கொடுப்பனவுக் கோப்பு கூறும் அமைப்பின்படி. கட்டுப்பாட்டுக் கூட்டுத்தொகைகளுடன் கூடிய நிலையான-அகல வங்கிக் கோப்பு இன்னும் அல்ல, காசோலை அச்சிடலும் அல்ல — அவற்றுக்கு உங்கள் வங்கியின் சொந்த விவரக்குறிப்பு தேவை (§21.17).',
  'payouts.fileDownloaded': 'கோப்பு பதிவிறக்கப்பட்டது',
  'payouts.fileDownloadedHint':
    'இதில் முழுக் கணக்கு எண்கள் உள்ளன, எனவே இந்தப் பதிவிறக்கம் உங்கள் பெயருடன் தணிக்கைப் பதிவில் பதியப்படுகிறது.',
  'payouts.fileFailed': 'கோப்பு உருவாக்கப்படவில்லை',

  'payouts.runTitle': '{{method}} · {{month}}',
  'payouts.runSubtitle': 'செலுத்த வேண்டிய வரிசைகள் {{lines}}, மொத்தம் {{total}}',
  'payouts.backToMonth': '{{month}} க்குத் திரும்பு',
  'payouts.releaseTitle': 'விடுவி',
  'payouts.releaseDescription':
    'இந்தச் சுற்றில் எதுவும் செலுத்தப்படவில்லை. மேலாளர் ஒருவர் இதை விடுவிக்கிறார், அது இதைத் தயாரித்த நபராக இருக்க முடியாது.',
  'payouts.releasedDescription':
    'இந்தச் சுற்று விடுவிக்கப்பட்டுவிட்டது. வங்கி என்ன செய்தது என்று வரிசை வரிசையாகப் பதிவு செய்யவும்.',
  'payouts.stat.payable': 'செலுத்த வேண்டியது',
  'payouts.stat.paid': 'செலுத்தப்பட்டது',
  'payouts.stat.failed': 'தோல்வியடைந்தது',
  'payouts.stat.held': 'நிறுத்தி வைக்கப்பட்டது',
  'payouts.heldExplanation':
    '{{count}} வரிசைகள் நிறுத்தி வைக்கப்பட்டுள்ளன: வழங்குநருக்குப் பணம் செலுத்த வேண்டியுள்ளது ஆனால் அதைச் செலுத்தக் கணக்கு இல்லை. கணக்குப் புத்தகம் பெறப்படும் வரை அவை இந்தச் சுற்றிலேயே இருக்கும், எதற்கும் எதிராகக் கணக்கிடப்படாது — அவை இல்லாமலும் சுற்று நிறைவு பெறலாம்.',
  'payouts.preparedBy': '{{name}} அவர்களால் {{when}} தயாரிக்கப்பட்டது',
  'payouts.releasedBy': '{{name}} அவர்களால் {{when}} விடுவிக்கப்பட்டது',
  'payouts.release': '{{total}} ஐ விடுவி',
  'payouts.releaseHint':
    'விடுவிப்பது பணம் செலுத்துவதற்கு அனுப்பப்பட்டுவிட்டது என்று பதிவு செய்கிறது.',
  'payouts.releaseNeedsManager': 'கொடுப்பனவுச் சுற்றை விடுவிப்பது மேலாளரின் தீர்மானம்.',
  'payouts.fourEyesHint':
    'இந்தச் சுற்றை நீங்கள் தயாரித்ததால், அதை வேறு ஒருவர் விடுவிக்க வேண்டும் (BR-501).',
  'payouts.nothingPayableHint':
    'இந்தச் சுற்றின் ஒவ்வொரு வரிசையும் நிறுத்தி வைக்கப்பட்டுள்ளது. விடுவிக்க எதுவும் இல்லை.',
  'payouts.approvedNotice':
    'விடுவிக்கப்பட்டது. வங்கி பதில் அளிக்கும்போது ஒவ்வொரு வரிசையையும் குறிக்கவும்.',
  'payouts.completedNotice': 'ஒவ்வொரு வரிசைக்கும் கணக்குக் கொடுக்கப்பட்டது, {{when}}.',
  'payouts.confirmReleaseTitle': 'இந்தச் சுற்றை விடுவிக்கவா?',
  'payouts.confirmReleaseBody':
    'இது தொழிற்சாலை இந்தச் செலுத்தல்களை அனுப்பிவிட்டது என்று பதிவு செய்கிறது. வங்கியிடம் கொடுக்கப்போவதுடன் மொத்தத்தை ஒப்பிட்டுச் சரிபார்க்கவும்.',
  'payouts.confirmRelease': 'சுற்றை விடுவி',
  'payouts.releaseNoteHint':
    'அவசியமில்லை. இந்தச் சுற்று பற்றி அலுவலகம் அறிய வேண்டியது எதுவும் இருந்தால்.',
  'payouts.approved': 'சுற்று விடுவிக்கப்பட்டது — {{total}}',
  'payouts.approveFailed': 'சுற்று விடுவிக்கப்படவில்லை',

  'payouts.linesTitle': 'வரிசைகள்',
  'payouts.linesDescription':
    'நிறுத்தி வைக்கப்பட்டவையும் செலுத்தப்படாதவையும் முதலில் — இன்னும் வேலை செய்ய வேண்டியவை அவையே.',
  'payouts.filterLines': 'எந்த வரிசைகள்',
  'payouts.filter.all': 'அனைத்து வரிசைகள்',
  'payouts.filter.held': 'நிறுத்தி வைக்கப்பட்டவை ({{count}})',
  'payouts.filter.pending': 'இன்னும் செலுத்தப்படவில்லை',
  'payouts.filter.failed': 'தோல்வியடைந்தவை',
  'payouts.filter.paid': 'செலுத்தப்பட்டவை',
  'payouts.noLinesHint': 'அந்த வடிகட்டிக்கு எந்த வரிசையும் பொருந்தவில்லை.',
  'payouts.line.pending': 'இன்னும் செலுத்தப்படவில்லை',
  'payouts.line.held': 'நிறுத்தி வைக்கப்பட்டது',
  'payouts.line.paid': 'செலுத்தப்பட்டது',
  'payouts.line.failed': 'தோல்வியடைந்தது',

  'payouts.markPaid': 'செலுத்தப்பட்டது',
  'payouts.markFailedShort': 'தோல்வியடைந்தது',
  'payouts.markPaidTitle': 'இந்தச் செலுத்தலைப் பதிவு செய்',
  'payouts.markPaidBody':
    'பணம் உண்மையில் கணக்கை விட்டு வெளியேறிய பின்னரே வரிசையைச் செலுத்தப்பட்டதாகக் குறிக்கவும்.',
  'payouts.markFailedTitle': 'தோல்வியடைந்த செலுத்தலைப் பதிவு செய்',
  'payouts.markFailedBody':
    'வழங்குநருக்குப் பணம் செலுத்தப்படவில்லை. நடந்ததை எழுதுங்கள் — இந்தச் சுற்றை அடுத்து எடுத்துக்கொள்பவர் உங்கள் குறிப்பையே அடிப்படையாகக் கொண்டு வேலை செய்வார்.',
  'payouts.reasonLabel': 'என்ன தவறு நடந்தது',
  'payouts.reasonHint': 'குறைந்தது {{min}} எழுத்துகள், எ.கா: வங்கி என்ன பதில் தந்தது.',
  'payouts.confirmPaid': 'செலுத்தப்பட்டதாகக் குறி',
  'payouts.confirmFailed': 'தோல்வியடைந்ததாகக் குறி',
  'payouts.markedPaid': '{{code}} செலுத்தப்பட்டதாகக் குறிக்கப்பட்டது',
  'payouts.markedFailed': '{{code}} தோல்வியடைந்ததாகக் குறிக்கப்பட்டது',
  'payouts.markFailed': 'வரிசை புதுப்பிக்கப்படவில்லை',

  /* ───────────────────────────── M8 Savings ───────────────────────────── */
  'savings.title': 'சேமிப்பு',
  'savings.subtitle': 'வழங்குநர்களுக்காகத் தொழிற்சாலை வைத்திருப்பது',
  'savings.balanceTotal': 'வழங்குநர்களுக்காக வைத்திருப்பது',
  'savings.contributedThisMonth': '{{month}} இல் சேர்க்கப்பட்டது',
  'savings.schemeTitle': 'திட்டம்',
  'savings.schemeDescription':
    'வழங்குநர் ஒரு கிலோவுக்கான வீதத்தைத் தேர்ந்தெடுக்கிறார், அது அவர்களின் மாதக் கணக்கிலிருந்து கழிக்கப்படுகிறது, தொழிற்சாலை அதை வைத்திருக்கிறது.',
  'savings.stat.accounts': 'கணக்குகள்',
  'savings.stat.optedOut': 'விலகியவர்கள்',
  'savings.stat.contributing': 'இந்த மாதம் சேர்த்தவர்கள்',
  'savings.stat.averagePerKg': 'கிலோவுக்குச் சராசரி',
  'savings.trendTitle': 'மாதம் வாரியாகச் சேமிப்பு',
  'savings.column.month': 'மாதம்',
  'savings.column.contributed': 'சேர்க்கப்பட்டது (ரூ.)',
  'savings.column.heldAfter': 'அதற்குப் பின் வைத்திருப்பது (ரூ.)',
  'savings.column.rate': 'வீதம் /கிலோ',
  'savings.column.balance': 'நிலுவை (ரூ.)',
  'savings.column.lastContribution': 'இறுதியாகச் சேர்த்தது',
  'savings.column.source': 'எங்கிருந்து',
  'savings.column.amount': 'தொகை (ரூ.)',
  'savings.liabilityNote':
    'இது வழங்குநர்களின் பணம், தொழிற்சாலையின் வருமானம் அல்ல. மாதம் ஒன்றை வெளியிடுவதன் மூலமே ஒரு பங்களிப்பு உருவாகிறது — அது வெளியிடப்பட்ட பில்லில் உள்ள சேமிப்பு வரிசையே — எனவே இங்கே சேர்க்கவோ திருத்தவோ எதுவும் இல்லை.',

  'savings.accountsTitle': 'சேமிப்புக் கணக்குகள்',
  'savings.searchPlaceholder': 'இலக்கம் அல்லது பெயரைத் தேடவும்',
  'savings.filterLabel': 'காட்டு',
  'savings.filter.any': 'அனைத்துக் கணக்குகள்',
  'savings.filter.contributing': 'சேர்ப்பவர்கள்',
  'savings.filter.optedOut': 'விலகியவர்கள்',
  'savings.contributing': 'சேர்க்கிறார்',
  'savings.neverContributed': 'ஒருபோதும் இல்லை',
  'savings.pendingRateChange': 'வீத மாற்றம் நிலுவையில்',

  'savings.ledgerTitle': 'சேமிப்புப் புத்தகம் · {{code}} {{name}}',
  'savings.ledgerSubtitle': 'நிலுவை {{balance}} · கிலோவுக்கு {{rate}}',
  'savings.ledgerTable': 'சேமிப்பு நடமாட்டங்கள், பழையவை முதலில்',
  'savings.source.openingBalance': 'தொடக்க நிலுவை',
  'savings.source.billDeduction': 'பில் கழிவு',
  'savings.source.adjustment': 'சரிசெய்தல்',
  'savings.source.withdrawal': 'எடுத்தல்',
  'savings.source.interest': 'வட்டி',
  'savings.noLedger': 'இந்தச் சேமிப்புப் புத்தகத்தில் இன்னும் எதுவும் இல்லை',
  'savings.noLedgerHint':
    'இந்த வழங்குநரின் பில்லில் சேமிப்புக் கழிவுடன் ஒரு மாதம் வெளியிடப்படும்போது ஒரு நடமாட்டம் இங்கே தோன்றும்.',
  'savings.withdrawalsPending':
    'எடுத்தல்களோ வட்டியோ இல்லை. வழங்குநர் எடுக்கவே முடியுமா — எத்தனை நாள் அறிவிப்பில், தொழிற்சாலை வட்டி செலுத்துமா — என்பது தொழிற்சாலையுடன் இன்னும் தீர்க்கப்படாத கேள்வி (§21.9), மேலும் ஊகித்த விதியின் அடிப்படையில் ஒருவரின் சேமிப்பை நகர்த்துவது கன்சோல் செய்யும் வேலை அல்ல.',

  /* ─────────── M11 News · M12 Static content (shared) ─────────── */
  /* AC-08 lives in this block: a missing translation must be visible to the editor,
     and every string below exists to say *what the gap costs* rather than that one
     exists. "Sinhala missing" is a fact; "a Sinhala supplier is reading English right
     now" is the thing that gets it fixed. */
  'content.languages': 'மொழிகள்',
  'content.language.si': 'சிங்களம்',
  'content.language.en': 'ஆங்கிலம்',
  'content.language.ta': 'தமிழ்',
  'content.fallbackLanguageHint':
    'அனைத்தும் பின்வாங்கிச் செல்லும் மொழி. அதை வெறுமையாக விட முடியாது.',
  'content.state.missing': '— இன்னும் எழுதப்படவில்லை',
  'content.state.stale': '— ஆங்கிலப் பாடத்தை விடப் பழையது',

  'content.copyTitle': 'பாடம்',
  'content.copyDescription':
    'ஒரு நேரத்தில் ஒரு மொழி. ஒரு மொழியைச் சேமிப்பது மற்றவற்றைத் தொடுவதில்லை.',
  'content.field.title': 'தலைப்பு',
  'content.field.titleHint': 'பட்டியலில் வழங்குநர் பார்ப்பது.',
  'content.field.excerpt': 'சுருக்கம்',
  'content.field.excerptHint':
    'ஒரு வரி, தலைப்புக்குக் கீழே செய்திச் சுருளில் காட்டப்படும். அவசியமில்லை.',
  'content.field.body': 'உள்ளடக்கம்',
  'content.field.bodyHint': 'எளிய உரை. வரி இடைவெளிகள் தக்கவைக்கப்படும்.',
  'content.translateFrom': '{{language}} இலிருந்து மொழிபெயர்க்கிறது',
  'content.save': '{{language}} ஐச் சேமி',
  'content.saved': '{{language}} சேமிக்கப்பட்டது',
  'content.saveFailed': 'அந்தப் பாடம் சேமிக்கப்படவில்லை',
  'content.saveNeedsCopy': 'இதைச் சேமிப்பதற்கு முன் தலைப்பும் உள்ளடக்கமும் தேவை.',
  'content.unsaved': 'சேமிக்கப்படாத மாற்றங்கள். மொழியை மாற்றினால் அவை இழக்கப்படும்.',
  'content.savedAt': '{{name}} அவர்களால் {{when}} சேமிக்கப்பட்டது.',
  'content.notWrittenYet': 'இந்த மொழியில் இன்னும் எதுவும் எழுதப்படவில்லை.',
  'content.readOnly': 'உள்ளடக்கத்தை மாற்றுவது ஆசிரியர் மட்டுமே.',
  'content.lastEditedBy': 'இறுதியாக {{name}} அவர்களால் {{when}} திருத்தப்பட்டது',
  'content.auditTitle': 'இந்தப் பதிவின் மாற்றங்கள்',

  'content.gap.complete': 'இந்தத் தொழிற்சாலை வெளியிடும் ஒவ்வொரு மொழியிலும் எழுதப்பட்டுள்ளது.',
  'content.gap.fallbackMissing':
    '{{language}} பாடம் இல்லை, எனவே எந்த மொழியிலும் வழங்குநருக்குக் காட்ட எதுவும் இல்லை. அது எழுதப்படும் வரை இதை வெளியிட முடியாது.',
  'content.gap.missingLive':
    '{{languages}} இல் பாடம் இல்லாமல் செயலில் உள்ளது. அந்த மொழிகளில் படிக்கும் வழங்குநர்களுக்கு இப்போது {{fallback}} பதிப்பே காட்டப்படுகிறது.',
  'content.gap.missingDraft': '{{languages}} இல் இன்னும் எழுதப்படவில்லை.',
  'content.gap.stale':
    '{{languages}} பாடம், அது மொழிபெயர்க்கப்பட்ட ஆங்கிலத்தை விடப் பழையது. செயலி அதைத் தற்போதையது போலவே காட்டுகிறது, எனவே வழங்குநருக்கு எதுவும் தவறாகத் தெரியாது.',
  'content.badge.missing': '{{count}} இல்லை',
  'content.badge.stale': '{{count}} காலாவதி',
  'content.badge.gaps': 'சரிசெய்ய {{count}}',
  'content.column.languages': 'மொழிகள்',
  'content.column.lastEdit': 'இறுதித் திருத்தம்',
  'content.complete': 'முழுமையானது',
  'content.lens': 'காட்டு',

  'content.previewTitle': 'வழங்குநர் பார்ப்பது',
  'content.previewDescription':
    '{{language}} இல் படிப்பவருக்கு, செயலி தீர்மானிக்கும் அதே முறையில் தீர்மானிக்கப்பட்டது.',
  'content.previewFallback':
    '{{requested}} பாடம் இல்லை, எனவே {{requested}} இல் படிப்பவருக்கு {{fallback}} பதிப்பு காட்டப்படுகிறது.',
  'content.previewEmpty': 'காட்டுவதற்கு எதுவும் இல்லை',
  'content.previewEmptyHint':
    'இன்னும் எந்த மொழியிலும் பாடம் இல்லை, எனவே செயலிக்கு காட்டுவதற்கு எதுவும் இருக்காது.',

  /* ───────────────────────────── M11 News ───────────────────────────── */
  'news.title': 'செய்திகள்',
  'news.subtitle': 'வழங்குநர்கள் செயலியில் படிக்கும் செய்திச் சுருள்',
  'news.searchPlaceholder': 'தலைப்புகளையும் பாடத்தையும் எந்த மொழியிலும் தேடவும்',
  'news.untitled': 'தலைப்பில்லாத கட்டுரை',
  'news.backToList': 'செய்திகளுக்குத் திரும்பு',
  'news.column.title': 'கட்டுரை',
  'news.column.published': 'வெளியிடப்பட்டது',
  'news.status.draft': 'வரைவு',
  'news.status.published': 'செயலில்',
  'news.status.archived': 'காப்பகப்படுத்தப்பட்டது',
  'news.lens.all': 'அனைத்துக் கட்டுரைகள்',
  'news.lens.incomplete': 'இடைவெளியுடன் செயலில்',
  'news.empty': 'இன்னும் கட்டுரைகள் இல்லை',
  'news.emptyHint': 'இங்கே வெளியிடப்படும் எதுவும் செயலியின் செய்திச் சுருளில் தோன்றும்.',
  'news.noIncomplete': 'செயலில் உள்ள எதற்கும் மொழிபெயர்ப்பு விடுபடவில்லை',
  'news.noIncompleteHint':
    'வெளியிடப்பட்ட ஒவ்வொரு கட்டுரையும் இந்தத் தொழிற்சாலை வெளியிடும் ஒவ்வொரு மொழியிலும் எழுதப்பட்டுள்ளது.',

  'news.create': 'புதிய கட்டுரை',
  'news.createTitle': 'புதிய கட்டுரை',
  'news.createDescription':
    'முதலில் ஆங்கிலப் பாடத்தை எழுதுங்கள் — மொழிபெயர்க்கப்படும் வரை மற்ற ஒவ்வொரு மொழியும் பின்வாங்கிச் செல்வது அதுவே.',
  'news.createDraftHint':
    'இது வரைவாக உருவாக்கப்படுகிறது. வெளியிடப்படும் வரை வழங்குநர்களை எதுவும் அடையாது.',
  'notifications.confirmSendBody': 'இந்தச் செய்தி {{count}} சாதனத்திற்கு உடனே அனுப்பப்படும்.',
  'notifications.confirmSendHint': 'ஒருமுறை அனுப்பியபின் அதைத் திரும்பப் பெற முடியாது.',
  'staticContent.publishConfirmTitle': '{{page}} ஐ வெளியிடவா?',
  'staticContent.publishConfirmBody': 'இது வழங்குநர்களுக்கு உடனே பக்கத்தைச் செயலில் கொண்டு வரும்.',
  'news.createConfirm': 'வரைவை உருவாக்கு',
  'news.created': 'வரைவு உருவாக்கப்பட்டது',
  'news.createdHint': 'மற்ற மொழிகளைச் சேர்த்து, பின்னர் வெளியிடவும்.',
  'news.createFailed': 'கட்டுரை உருவாக்கப்படவில்லை',

  'news.lifecycleTitle': 'வெளியிடுதல்',
  'news.lifecycleDraft': 'இங்குள்ள எதுவும் இன்னும் வழங்குநரை அடையவில்லை.',
  'news.lifecyclePublished': 'இது செயலியில் செயலில் உள்ளது.',
  'news.publishedBy': '{{name}} அவர்களால் {{when}} வெளியிடப்பட்டது.',
  'news.publish': 'வெளியிடு',
  'news.unpublish': 'நீக்கு',
  'news.archive': 'காப்பகப்படுத்து',
  'news.published': 'வெளியிடப்பட்டது — அது இப்போது செயலியின் செய்திச் சுருளில் உள்ளது',
  'news.unpublished': 'நீக்கப்பட்டது. அது இனி செய்திச் சுருளில் இல்லை.',
  'news.archived': 'காப்பகப்படுத்தப்பட்டது',
  'news.publishFailed': 'கட்டுரை வெளியிடப்படவில்லை',
  'news.unpublishFailed': 'கட்டுரை நீக்கப்படவில்லை',
  'news.archiveFailed': 'கட்டுரை காப்பகப்படுத்தப்படவில்லை',
  'news.publishNeedsAdmin': 'வெளியிடுவது தொழிற்சாலை நிர்வாகியின் தீர்மானம்.',
  'news.noDeleteHint':
    'கட்டுரைகள் காப்பகப்படுத்தப்படுகின்றன, ஒருபோதும் அழிக்கப்படுவதில்லை — வழங்குநர் ஒருவர் அதைப் படித்திருக்கலாம், அதைப் பற்றிக் கேட்கவும் கூடும்.',
  'news.confirm.publishTitle': 'இந்தக் கட்டுரையை வெளியிடவா?',
  'news.confirm.publishBody':
    'இது ஒவ்வொரு வழங்குநருக்கும் செயலியின் செய்திச் சுருளில் உடனே தோன்றும்.',
  'news.confirm.publishAction': 'வெளியிடு',
  'news.confirm.publishWithGaps':
    'மொழிகள் விடுபட்டிருக்கும்போதும் நீங்கள் வெளியிடலாம் — செயலி ஆங்கிலத்திற்குப் பின்வாங்கும் — ஆனால் மொழிபெயர்க்கப்படும் வரை அந்த வழங்குநர்கள் அதை ஆங்கிலத்திலேயே படிப்பார்கள்.',
  'news.confirm.unpublishTitle': 'இதை நீக்கவா?',
  'news.confirm.unpublishBody':
    'இது செய்திச் சுருளை விட்டு வெளியேறும். ஏற்கெனவே படித்த வழங்குநர்களுக்கு அவர்கள் படித்தது அப்படியே இருக்கும்; பாடம் அழிக்கப்படுவதில்லை.',
  'news.confirm.unpublishAction': 'நீக்கு',
  'news.confirm.archiveTitle': 'இந்தக் கட்டுரையைக் காப்பகப்படுத்தவா?',
  'news.confirm.archiveBody':
    'இது செய்திச் சுருளையும் வேலைப் பட்டியலையும் விட்டு வெளியேறி, பதிவில் எஞ்சியிருக்கும். எதுவும் அழிக்கப்படுவதில்லை.',
  'news.confirm.archiveAction': 'காப்பகப்படுத்து',

  /* ───────────────────── M12 Static content ───────────────────── */
  'staticContent.title': 'நிலையான பக்கங்கள்',
  'staticContent.subtitle': 'செயலியின் நிலையான பக்கங்கள்',
  'staticContent.pagesTitle': 'பக்கங்கள்',
  'staticContent.page.faq': 'அடிக்கடி கேட்கப்படும் கேள்விகள்',
  'staticContent.page.savingsScheme': 'சேமிப்புத் திட்டம்',
  'staticContent.page.creditTerms': 'கடன் நிபந்தனைகள்',
  'staticContent.page.about': 'தொழிற்சாலை பற்றி',
  'staticContent.page.terms': 'வழங்கல் நிபந்தனைகள்',
  'staticContent.page.privacy': 'தனியுரிமை',
  'staticContent.status.draft': 'வெளியிடப்படவில்லை',
  'staticContent.status.published': 'செயலில்',
  'staticContent.notWritten': 'ஒருபோதும் எழுதப்படவில்லை',
  'staticContent.draftDescription':
    'இந்தப் பக்கம் ஒருபோதும் வெளியிடப்படவில்லை, எனவே செயலி அதன் சொந்த உள்ளமைந்த பதிப்பையே காட்டுகிறது.',
  'staticContent.liveDescription':
    '{{name}} அவர்களால் வெளியிடப்பட்டு, {{when}} முதல் செயலில் உள்ளது.',
  'staticContent.publish': 'இந்தப் பக்கத்தை வெளியிடு',
  'staticContent.publishHint':
    'இதற்குப் பின், ஒரு திருத்தத்தைச் சேமிப்பதே அதை உடனே வழங்குநர்கள் முன் கொண்டு வைக்கும் — இரண்டாவது படி எதுவும் இல்லை.',
  'staticContent.publishNeedsCopy': 'முதலில் {{language}} பாடத்தை எழுதுங்கள்.',
  'staticContent.publishNeedsAdmin': 'வெளியிடுவது தொழிற்சாலை நிர்வாகியின் தீர்மானம்.',
  'staticContent.published': '{{page}} செயலில் உள்ளது',
  'staticContent.publishFailed': 'பக்கம் வெளியிடப்படவில்லை',
  'staticContent.editsAreLive':
    'இந்தப் பக்கம் செயலில் உள்ளது. ஒரு திருத்தம் சேமிக்கப்பட்ட உடனேயே வழங்குநர்களை அடையும் — ஒவ்வொரு மாற்றமும் முந்தைய சொற்களுடன் தணிக்கைப் பதிவில் குறிக்கப்படும்.',
  'staticContent.savedLive': 'வழங்குநர்கள் இப்போது இதைப் பார்க்கிறார்கள்.',

  /* ───────────────────────── M13 Notifications ───────────────────────── */
  /* §21.24 is unanswered — whether the office composes every send or whether
     bill-published fires off the publish step. The console does both and makes the
     choice a toggle, so the copy here has to explain a *mechanism* rather than assert
     a policy. */
  'notifications.title': 'அறிவிப்புகள்',
  'notifications.subtitle':
    'வழங்குநர்களுக்குத் தெரிவிக்கப்பட்டவை, மற்றும் தொழிற்சாலை தானாகவே அவர்களுக்குத் தெரிவிப்பவை',
  'notifications.compose': 'அறிவிப்பு ஒன்றை எழுது',

  'notifications.category.billPublished': 'கணக்கு வெளியிடப்பட்டது',
  'notifications.category.requestDecided': 'வேண்டுகோள் தீர்மானிக்கப்பட்டது',
  'notifications.category.newsArticle': 'செய்திக் கட்டுரை',
  'notifications.category.inquiryReplied': 'செய்திக்குப் பதில் அளிக்கப்பட்டது',
  'notifications.event.billPublished':
    'விலை மற்றும் மாத நிறைவில் ஒரு மாதம் வெளியிடப்படும்போது இயங்குகிறது.',
  'notifications.event.requestDecided':
    'மாற்ற வேண்டுகோள் ஒன்று அனுமதிக்கப்படும்போது அல்லது நிராகரிக்கப்படும்போது இயங்குகிறது.',
  'notifications.event.newsArticle': 'செய்திக் கட்டுரை ஒன்று வெளியிடப்படும்போது இயங்குகிறது.',
  'notifications.event.inquiryReplied':
    'அலுவலகம் ஒரு செய்திக்குப் பதில் அளிக்கும்போது இயங்குகிறது.',

  'notifications.triggersTitle': 'தானியங்கி அறிவிப்புகள்',
  'notifications.triggersDescription':
    'ஏதாவது நடக்கும்போது, யாரும் எதையும் அழுத்தாமல் அமைப்பால் அனுப்பப்படுகிறது.',
  'notifications.on': 'இயக்கத்தில்',
  'notifications.off': 'முடக்கம்',
  'notifications.notConfigured': 'இந்தத் தொழிற்சாலைக்கு அமைக்கப்படவில்லை',
  'notifications.triggerChanged': '{{name}} அவர்களால் {{when}} மாற்றப்பட்டது.',
  'notifications.triggerOn': '{{category}} இப்போது தானாகவே அனுப்பப்படும்',
  'notifications.triggerOff': '{{category}} இனி தானாகவே அனுப்பப்படாது',
  'notifications.triggerFailed': 'அந்த அமைப்பு மாற்றப்படவில்லை',
  'notifications.triggersNeedAdmin':
    'தானாகவே அனுப்பப்படுவதை மாற்றக்கூடியவர் தொழிற்சாலை நிர்வாகி மட்டுமே.',
  'notifications.openQuestion':
    'அலுவலகம் ஒவ்வொரு செய்தியையும் கையால் எழுதுகிறதா, அல்லது அமைப்பு அவற்றைத் தானாகவே அனுப்புகிறதா என்பது தொழிற்சாலையுடன் இன்னும் தீர்க்கப்படாத கேள்வி (§21.24). அது தீரும் வரை இரண்டுமே வேலை செய்யும், மேலும் இந்தச் சுவிட்சுகளே அதற்குப் பதில் — அதைத் தீர்மானிக்க எந்தக் குறிமுறை மாற்றமும் தேவையில்லை.',

  'notifications.column.message': 'செய்தி',
  'notifications.column.category': 'வகை',
  'notifications.column.audience': 'அனுப்பப்பட்டவர்கள்',
  'notifications.column.reach': 'சென்றடைந்தது',
  'notifications.firedBy': 'தானாகவே அனுப்பப்பட்டது',
  'notifications.composedBy': '{{name}} அவர்களால் எழுதப்பட்டது',
  'notifications.reachedDevices': 'தொலைபேசிகள் {{count}}',
  'notifications.optedOutDevices': '{{count}} விலகியுள்ளன',
  'notifications.audience.allSuppliers': 'ஒவ்வொரு வழங்குநரும்',
  'notifications.audience.collectionPoint': '{{point}} மட்டும்',
  'notifications.audience.supplier': 'ஒரு வழங்குநர்',
  'notifications.filterLabel': 'காட்டு',
  'notifications.filter.all': 'அனைத்து அறிவிப்புகள்',
  'notifications.filter.automatic': 'தானாகவே அனுப்பப்பட்டவை',
  'notifications.filter.composed': 'அலுவலகம் எழுதியவை',
  'notifications.empty': 'இன்னும் எதுவும் அனுப்பப்படவில்லை',
  'notifications.emptyHint':
    'தானியங்கி அறிவிப்புகள் இயங்கும்போது இங்கே தோன்றும், மேலும் அலுவலகம் எழுதுவது எதுவும் அவற்றுடனேயே தோன்றும்.',
  'notifications.noDeliveryReports':
    'தொலைபேசி ஒருபோதும் திரும்பத் தெரிவிப்பதில்லை, எனவே இவை அனுப்பிய தருணத்தின் மதிப்புகள் — யாரோ அதைப் படித்தார் என்பதற்கான சான்று அல்ல.',
  'notifications.useNewsHint':
    'அறிவிப்பு என்பது ஒரு தலைப்பு, கட்டுரை அல்ல. அதைவிட நீளமான எதுவும் சேர வேண்டிய இடம்',

  'notifications.composeTitle': 'அறிவிப்பு ஒன்றை எழுது',
  'notifications.composeDescription':
    'நீங்கள் தேர்ந்தெடுக்கும் பிரிவின் ஒவ்வொரு வழங்குநரின் பூட்டுத் திரையிலும் இது தோன்றும்.',
  'notifications.field.category': 'வகை',
  'notifications.field.categoryHint':
    'செயலி எந்தத் திரையைத் திறக்கும் என்பதைத் தீர்மானிக்கிறது. செயலி அறியாத எதையும் புறக்கணிக்கிறது, எனவே இது வெறும் தோற்றத்திற்கானது அல்ல.',
  'notifications.field.categoryPlaceholder': 'வகை ஒன்றைத் தேர்ந்தெடுக்கவும்',
  'notifications.field.audience': 'யாருக்கு அனுப்புவது',
  'notifications.field.pickPoint': 'சேகரிப்பு நிலையம் ஒன்றைத் தேர்ந்தெடுக்கவும்',
  'notifications.audienceKind.allSuppliers': 'ஒவ்வொரு வழங்குநரும்',
  'notifications.audienceKind.collectionPoint': 'ஒரு சேகரிப்பு நிலையம்',
  'notifications.field.title': 'தலைப்பு',
  'notifications.field.titleHint':
    'அதிகபட்சம் {{max}} எழுத்துகள் — பூட்டுத் திரை மீதியை வெட்டிவிடும்.',
  'notifications.field.body': 'செய்தி',
  'notifications.field.bodyHint': 'அதிகபட்சம் {{max}} எழுத்துகள். முழுவதையும் இங்கேயே கூறுங்கள்.',
  'notifications.reachLoading': 'இது யாரைச் சென்றடையும் என்று கணக்கிடப்படுகிறது…',
  'notifications.reachSummary':
    'வழங்குநர்கள் {{suppliers}} பேர் வழியாகத் தொலைபேசிகள் {{devices}} ஐச் சென்றடையும்.',
  'notifications.reachSuppressed':
    'தொலைபேசிகள் {{count}} இல் “{{category}}” முடக்கப்பட்டுள்ளது, எனவே அவற்றுக்கு இது கிடைக்காது.',
  'notifications.reachNoDevice':
    'இந்தப் பிரிவின் வழங்குநர்கள் {{count}} பேர் ஒருபோதும் செயலியை நிறுவவில்லை.',
  'notifications.reachNobody':
    'இந்தப் பிரிவில் யாருக்கும் அது கிடைக்காது. அதற்குப் பதிலாக அதை அறிவிப்புப் பலகையில் வைக்கவும், அல்லது வேறு வகையைத் தேர்ந்தெடுக்கவும்.',
  'notifications.noRecallHint':
    'அறிவிப்பைத் திரும்பப் பெற முடியாது, மேலும் தொலைபேசி அதைக் காட்டியதா என்பதை எதுவும் தெரிவிப்பதில்லை.',
  'notifications.send': 'அனுப்பு',
  'notifications.sendToCount': 'தொலைபேசிகள் {{count}} க்கு அனுப்பு',
  'notifications.sent': 'தொலைபேசிகள் {{count}} க்கு அனுப்பப்பட்டது',
  'notifications.sentSuppressed':
    'தொலைபேசிகள் {{count}} இல் இந்த வகை முடக்கப்பட்டுள்ளது, எனவே அவற்றுக்கு அது கிடைக்கவில்லை.',
  'notifications.sendFailed': 'எதுவும் அனுப்பப்படவில்லை',

  /* ───────────────────────── M14 Configuration ───────────────────────── */
  /* AC-12 lives in this block: "a new factory goes live without a code deploy". The copy
     has to explain *consequences*, because every edit here reaches across modules the
     reader cannot see from this screen. */
  'configuration.title': 'கட்டமைப்பு',
  'configuration.subtitle': 'இந்தத் தொழிற்சாலை பற்றி குறிமுறை அல்லாமல் தரவாக உள்ள அனைத்தும்',
  'config.tenantId': 'தொழிற்சாலை அடையாளம்',
  /* Why the id is shown but greyed: it comes from the subdomain and every record in
     the factory is keyed on it, so the API refuses a patch that contains it
     (`tenant-immutable`). Without this the popover that exists to say so rendered
     its own key. */
  'config.tenantIdHint':
    'இது தொழிற்சாலையின் வலை முகவரியிலிருந்து வருகிறது, எனவே இதை இங்கே மாற்ற முடியாது — ஒவ்வொரு பதிவும் அதன் கீழேயே பதியப்பட்டுள்ளது.',
  'config.readOnlyBadge': 'படிக்க மட்டும்',
  'config.readOnly': 'கட்டமைப்பை மாற்றக்கூடியவர் தொழிற்சாலை நிர்வாகி மட்டுமே.',
  'config.sections': 'அமைப்புகள்',
  'config.save': 'இந்தப் பகுதியைச் சேமி',
  'config.saved': 'கட்டமைப்பு சேமிக்கப்பட்டது',
  'config.savedHint': 'மாற்றம் கன்சோல் முழுவதும் செயலில் உள்ளது — மீண்டும் ஏற்ற வேண்டியதில்லை.',
  'config.saveFailed': 'எதுவும் சேமிக்கப்படவில்லை',
  'config.revert': 'மாற்றங்களை மீளச் செய்',
  'config.unsavedHint': 'இந்தப் பகுதியில் சேமிக்கப்படாத மாற்றங்கள் உள்ளன.',
  'config.nothingToSave': 'எதுவும் மாறவில்லை.',
  'config.blockedHint': 'சேமிப்பதற்கு முன் மேலே உள்ள பிரச்சினையைச் சரிசெய்யவும்.',
  'config.remove': 'நீக்கு',
  'config.inUse': '{{count}} பயன்படுத்துகிறது',
  'config.listEmpty': 'இன்னும் இங்கே எதுவும் இல்லை.',
  'config.ac12Note':
    'தொழிற்சாலை ஒன்றை அமைக்கும் முழு வேலையும் இந்தத் திரையே. புதிய தொழிற்சாலைக்குத் தேவைப்படுவது ஒரு வலை முகவரியும் இந்தப் பக்கத்தின் அமைப்புகளும் மட்டுமே — கன்சோலின் புதிய பதிப்பு அல்ல, மேலும் உருவாக்குநர் செய்ய எதுவும் இல்லை.',

  'config.section.factory': 'தொழிற்சாலை',
  'config.sectionHint.factory': 'பெயர், பதிவு, தொடர்பு',
  'config.sectionDescription.factory':
    'அச்சிடப்பட்ட கொழுந்து கணக்கிலும் செயலியின் உதவித் திரைகளிலும் தோன்றுவது.',
  'config.section.features': 'வசதிகள்',
  'config.sectionHint.features': 'இந்தத் தொழிற்சாலை வழங்குவது',
  'config.sectionDescription.features':
    'வசதி ஒன்றை முடக்குவது அதை முழுவதுமாக நீக்குகிறது — மெனு வரிசை, திரைகள், மற்றும் செயலி.',
  'config.section.operations': 'சேகரிப்பும் செலுத்தலும்',
  'config.sectionHint.operations': 'நிலையங்கள், வங்கிகள், சேமிப்பு வீதங்கள்',
  'config.sectionDescription.operations':
    'எடை பார்க்கும் நிலையங்கள், கொடுப்பனவுச் சுற்றுகள் மற்றும் சேமிப்புத் திட்டம் தேர்ந்தெடுக்கும் பட்டியல்கள்.',
  'config.section.appearance': 'மொழிகளும் அடையாளச் சின்னமும்',
  'config.sectionHint.appearance': 'மொழிகள், சின்னம், நிறங்கள்',
  'config.sectionDescription.appearance':
    'உள்ளடக்கம் எந்த மொழிகளில் எழுதப்படுகிறது, மேலும் கன்சோலும் செயலியும் தோன்றும் விதம்.',
  'config.section.push': 'அறிவிப்புகள்',
  'config.sectionHint.push': 'அனுப்பக்கூடியவை',
  'config.sectionDescription.push':
    'இந்தத் தொழிற்சாலை அனுப்பக்கூடிய அறிவிப்பு வகைகள் எவை, மேலும் புதிய தொலைபேசி ஏற்பவை எவை.',

  'config.factory.name': 'தொழிற்சாலையின் பெயர்',
  'config.factory.nameHint': 'ஒவ்வொரு கணக்கிலும் செயலியிலும் தோன்றுகிறது.',
  'config.factory.regNo': 'பதிவு இலக்கம்',
  'config.factory.regNoHint': 'கொழுந்து கணக்கில் அச்சிடப்படுகிறது.',
  'config.factory.telephone': 'தொலைபேசி',
  'config.factory.location': 'இடம்',
  'config.factory.supportEmail': 'அலுவலக மின்னஞ்சல்',
  'config.factory.supportHours': 'அலுவலக நேரம்',
  'config.factory.legalFooter': 'சட்ட அடிக்குறிப்பு',
  'config.factory.legalFooterHint': 'அச்சிடப்பட்ட கணக்கின் அடியில் உள்ள சிறிய எழுத்து.',

  'config.flagGates': '{{module}} ஐ கன்சோலிலிருந்தும் செயலியிலிருந்தும் நீக்குகிறது.',
  'config.flag.enableSavings': 'சேமிப்புத் திட்டம்',
  'config.flag.enableAdvances': 'கொழுந்தின் மேல் முன்பணம்',
  'config.flag.enableLoans': 'வருமான வரலாற்றின் மேல் கடன்',
  'config.flag.enableManure': 'கடனுக்கு உரம்',
  'config.flag.enableInquiry': 'வழங்குநர்களின் செய்திகள்',
  'config.flag.enableNews': 'செய்திச் சுருள்',
  'config.flag.enablePushNotifications': 'அறிவிப்புகள்',
  'config.flag.enablePromoBanner': 'விளம்பரப் பட்டை',
  'config.flag.enablePayouts': 'கொடுப்பனவுச் சுற்றுகள்',
  'config.flag.enableReports': 'அறிக்கைகள்',

  'config.points': 'சேகரிப்பு நிலையங்கள்',
  'config.addPoint': 'நிலையம் ஒன்றைச் சேர்',
  'config.banks': 'வங்கிகள்',
  'config.addBank': 'வங்கி ஒன்றைச் சேர்',
  'config.branchesOf': '{{bank}} இன் கிளைகள்',
  'config.addBranch': 'கிளை ஒன்றைச் சேர்',
  'config.savingsRates': 'வழங்குநர் தேர்ந்தெடுக்கக்கூடிய சேமிப்பு வீதங்கள் (கிலோவுக்கு ரூ.)',
  'config.addRate': 'வீதம் ஒன்றைச் சேர்',

  'config.contentLanguages': 'உள்ளடக்கம் எழுதப்படும் மொழிகள்',
  'config.contentLanguagesHint':
    'செய்திக் கட்டுரைகளும் செயலியின் நிலையான பக்கங்களும் இவை ஒவ்வொன்றிலும் எழுதப்படும். குறிக்கப்படாத மொழி விடுபட்டதாகக் கணக்கிடப்படுவது நின்றுவிடும்.',
  'config.fallbackRequired': '— அவசியம்',
  'config.recordsWritten': 'பதிவுகள் {{count}} எழுதப்பட்டுள்ளன',
  'config.defaultLanguage': 'செயலியின் இயல்பு மொழி',
  'config.defaultLanguageHint': 'வழங்குநர் ஒன்றைத் தேர்ந்தெடுப்பதற்கு முன் பார்ப்பது.',
  'config.logoUrl': 'சின்னத்தின் முகவரி',
  'config.logoUrlHint':
    'ஒரு வலை முகவரி. வெறுமையாக விட்டால், உள்ளமைந்த தேயிலைச் சின்னம் பயன்படுத்தப்படும்.',
  'config.faviconUrl': 'உலாவிச் சின்னத்தின் முகவரி',
  'config.colour.primary': 'முதன்மை நிறம்',
  'config.colour.secondary': 'இரண்டாம் நிறம்',

  'config.topicPrefix': 'அறிவிப்புத் தலைப்பு முன்னொட்டு',
  'config.topicPrefixHint': 'தொழில்நுட்பம். செய்தி வழங்குநர் கேட்டால் மட்டுமே இதை மாற்றவும்.',
  'config.pushCategories': 'இந்தத் தொழிற்சாலை அனுப்பும் அறிவிப்பு வகைகள்',
  'config.pushCategoriesHint':
    'குறிக்கப்பட்ட வகையை மட்டுமே அனுப்ப முடியும். இரண்டாவது கட்டம், வழங்குநர் அதை இயக்காமலேயே தொலைபேசி அதை ஏற்கிறதா என்பது.',
  'config.optedInByDefault': 'இயல்பாகவே ஏற்கப்படுகிறது',
  'config.pushFlagOff':
    'இந்தத் தொழிற்சாலைக்கு அறிவிப்புகள் முடக்கப்பட்டுள்ளன, எனவே இங்குள்ள எதற்கும் இன்னும் எந்தத் தாக்கமும் இல்லை. முதலில் வசதிகளின் கீழ் அவற்றை இயக்கவும்.',

  /* The impact list. Each of these is why a change is refused or worth thinking about —
     rendered from the same `configImpact` the API refuses with, so the two can never
     name different things. */
  'config.impact.savingsHeld':
    'வழங்குநர்கள் {{count}} பேருக்குச் சேமிப்புத் திட்டத்தில் பணம் உள்ளது. அதை முடக்குவது தொழிற்சாலை அவர்களுக்காக வைத்திருக்கும் நிலுவைகளை மறைத்துவிடும், எனவே இதைச் சேமிக்க முடியாது.',
  'config.impact.payoutRunsOpen':
    'கொடுப்பனவுச் சுற்றுகள் {{count}} நிறைவு பெறவில்லை. கொடுப்பனவுகளை முடக்குவது இன்னும் செலுத்தப்படாத பணத்தை மறைத்துவிடும், எனவே இதைச் சேமிக்க முடியாது.',
  'config.impact.creditOutstanding':
    'வழங்குநர்கள் {{facility}} இல் இன்னும் ரூ. {{amount}} செலுத்த வேண்டியுள்ளது. அதை முடக்குவது அதை மறைத்துவிடும், எனவே இதைச் சேமிக்க முடியாது.',
  'config.impact.surfaceRemoved':
    'அனைவருக்கும் இது உடனே மெனுவிலிருந்து போய்விடும், மேலும் செயலி அதை வழங்குவதை நிறுத்தும்.',
  'config.impact.pointInUse':
    'எடை பார்த்தல்கள் {{count}} {{point}} இன் கீழ் பதியப்பட்டுள்ளன. அதை நீக்குவது அவை இனி இல்லாத ஒரு இடத்தைச் சுட்டிக்காட்டும் நிலையில் விட்டுவிடும், எனவே இதைச் சேமிக்க முடியாது.',
  'config.impact.bankInUse':
    'வழங்குநர்கள் {{count}} பேருக்கு {{bank}} வழியாகச் செலுத்தப்படுகிறது. அவர்களின் விவரங்களில் பெயர் அப்படியே இருக்கும்; புதியவற்றுக்கு அது வழங்கப்படுவது மட்டும் நின்றுவிடும்.',
  'config.impact.languageDropped':
    '{{lang}} இல் உள்ளடக்கம் எதுவும் எழுதப்படவில்லை, எனவே எதுவும் இழக்கப்படாது.',
  'config.impact.languageDroppedWithCopy':
    'பதிவுகள் {{count}} {{lang}} இல் எழுதப்பட்டுள்ளன. பாடம் எஞ்சியிருக்கும், ஆனால் அது விடுபட்டதாகக் கணக்கிடப்படுவது நின்றுவிடும் — எனவே அது காலாவதியாகிவிட்டது என்று எதுவும் உங்களுக்குச் சொல்லாது.',
  'config.section.payoutFile': 'கொடுப்பனவுக் கோப்பு',
  'config.sectionHint.payoutFile': 'கொடுப்பனவுச் சுற்று எழுதப்படும் விதம்',
  'config.sectionDescription.payoutFile':
    'வங்கிக்கு நீங்கள் பதிவேற்றும் கோப்பின் அமைப்பு — எந்த நெடுவரிசைகள், எந்த வரிசையில், எந்தத் தலைப்புகளுடன் என்பது.',

  /* §21.17, அமைவாக. இந்த வாசகம் செய்ய வேண்டிய முக்கியமான ஒன்று: நெடுவரிசை
     வார்ப்புருவை அமைத்துவிட்டு SLIPS கோப்பை உருவாக்கிவிட்டதாக யாரும்
     நம்பிவிடாமல் தடுப்பது. */
  'config.payoutFile.scope':
    'உங்கள் வங்கி கேட்கும் தாளுக்கு ஏற்ப இதை அமைக்கவும். இது பிரிக்கப்பட்ட (delimited) கோப்பை எழுதுகிறது — பெரும்பாலான வங்கிகளின் மொத்தப் பதிவேற்றத் தாள்கள் அப்படித்தான். கட்டுப்பாட்டுக் கூட்டுத்தொகைகளுடன் கூடிய நிலையான-அகல கோப்பையோ, முன்-அச்சிடப்பட்ட காசோலைத் தாள்களில் அச்சிடுவதையோ இன்னும் செய்ய முடியாது; அவற்றுக்கு வங்கியின் சொந்த விவரக்குறிப்பு தேவை (§21.17).',
  'config.payoutFile.preset': 'தொடங்கும் இடம்',
  'config.payoutFile.presetHint':
    'பிறகு நீங்கள் சரிசெய்யும் ஒரு தொடக்கப் புள்ளி. “எளிய விரிதாள்” மட்டுமே முழுமையானது — மற்ற இரண்டும் அந்தத் திட்டங்கள் பொதுவாகக் கேட்கும் நெடுவரிசைகள், தலைப்புகள் உங்கள் வங்கியின் விவரக்குறிப்பிலிருந்து நிரப்ப வெறுமையாக விடப்பட்டுள்ளன.',
  'config.payoutFile.preset.genericCsv': 'எளிய விரிதாள்',
  'config.payoutFile.preset.slipsSkeleton': 'SLIPS (நிரப்பவும்)',
  'config.payoutFile.preset.ceftsSkeleton': 'CEFTS (நிரப்பவும்)',

  'config.payoutFile.delimiter': 'பிரிப்பான்',
  'config.payoutFile.delimiter.comma': 'காற்புள்ளி  ,',
  'config.payoutFile.delimiter.semicolon': 'அரைப்புள்ளி  ;',
  'config.payoutFile.delimiter.pipe': 'செங்குத்துக் கோடு  |',
  'config.payoutFile.delimiter.tab': 'டேப்',
  'config.payoutFile.headerRow': 'தலைப்புகளை முதல் வரியாக எழுதவும்',
  'config.payoutFile.amountFormat': 'தொகைகள் எழுதப்படும் விதம்',
  'config.payoutFile.amountFormatHint':
    'இதை உங்கள் வங்கியின் தாளுடன் சரிபார்க்கவும். சதம் எதிர்பார்க்கப்படும் இடத்தில் ரூபாயை அனுப்புவது ஒவ்வொரு சப்ளையருக்கும் அவர்களுக்கு உரியதில் நூறில் ஒரு பங்கைச் செலுத்தும், வங்கி அதை மகிழ்ச்சியுடன் செயலாக்கும்.',
  'config.payoutFile.amountFormat.decimal2': '4213.50  — ரூபாயும் சதமும்',
  'config.payoutFile.amountFormat.cents': '421350  — சதம், தசமப் புள்ளி இல்லை',
  'config.payoutFile.amountFormat.whole': '4214  — முழு ரூபாய்',
  'config.payoutFile.accountFormat': 'கணக்கு எண்கள் எழுதப்படும் விதம்',
  'config.payoutFile.accountFormat.plain': 'பதிவு செய்யப்பட்டவாறே',
  'config.payoutFile.accountFormat.digitsOnly': 'இலக்கங்கள் மட்டும் — கோடுகளும் இடைவெளிகளும் நீக்கப்படும்',
  'config.payoutFile.reference': 'குறிப்பு',
  'config.payoutFile.referenceHint':
    'சப்ளையர் தமது வங்கி அறிக்கையில் காண்பது. {{code}} அவர்களின் சப்ளையர் குறியீடாகவும் {{month}} மாதமாகவும் மாறும்.',

  'config.payoutFile.columns': 'நெடுவரிசைகள், வரிசைப்படி',
  'config.payoutFile.columnsHint':
    'இங்குள்ள வரிசையே கோப்பிலுள்ள வரிசை. நீங்கள் தட்டச்சு செய்யும் அப்படியே தலைப்பை வங்கி பொருத்திப் பார்க்கும், எனவே அதை மொழிபெயர்ப்பதற்குப் பதிலாக அவர்களின் தாளிலிருந்து நகலெடுக்கவும்.',
  'config.payoutFile.headingFor': '{{field}} க்கான தலைப்பு',
  'config.payoutFile.headingPlaceholder': 'வங்கி எழுதுவது போல',
  'config.payoutFile.moveUp': 'மேலே நகர்த்து',
  'config.payoutFile.moveDown': 'கீழே நகர்த்து',
  'config.payoutFile.removeColumn': '{{field}} நீக்கு',
  'config.payoutFile.bankOnly': '· காசோலை மற்றும் ரொக்கச் சுற்றுகளில் வெறுமை',

  'config.payoutFile.field.supplierCode': 'சப்ளையர் குறியீடு',
  'config.payoutFile.field.supplierName': 'சப்ளையர் பெயர்',
  'config.payoutFile.field.accountNumber': 'கணக்கு எண்',
  'config.payoutFile.field.bankName': 'வங்கி',
  'config.payoutFile.field.branchName': 'கிளை',
  'config.payoutFile.field.amount': 'தொகை',
  'config.payoutFile.field.reference': 'குறிப்பு',
  'config.payoutFile.field.monthKey': 'மாதம்',
  'config.payoutFile.field.method': 'கொடுப்பனவு முறை',

  'config.payoutFile.preview': 'கோப்பு எப்படி இருக்கும்',
  'config.payoutFile.previewHint':
    'கற்பனையான இரு சப்ளையர்கள், இரண்டாமவருக்கு வங்கி விவரங்கள் இல்லை — எனவே காசோலை அல்லது ரொக்க வரி ஒவ்வொரு நெடுவரிசைக்கும் என்ன செய்கிறது என்பதைக் காணலாம். உண்மையான கோப்பை எழுதும் அதே நிரலால் எழுதப்பட்டது.',
  'config.payoutFile.previewBlocked': 'மேலுள்ள சிக்கல்களைச் சரிசெய்தால் மாதிரி தோன்றும்.',

  /* இவை ஒவ்வொன்றும் சேமிப்பைத் தடுக்கின்றன: தவறான அமைப்பின் விளைவு வங்கி
     நிராகரிக்கும் கோப்பு, அதைக் கண்டுபிடிப்பவர் பணம் பெறாத சப்ளையர். */
  'config.impact.payoutTemplate.no-columns':
    'கோப்பில் நெடுவரிசைகள் இல்லை, எனவே அது வெறுமையாக இருக்கும். குறைந்தபட்சம் தொகையைச் சேர்க்கவும்.',
  'config.impact.payoutTemplate.no-amount':
    'தொகை நெடுவரிசை இல்லை. அது இல்லாத கோப்பு கொடுப்பனவு அறிவுறுத்தல் அல்ல, பெயர்ப் பட்டியல்.',
  'config.impact.payoutTemplate.duplicate-field':
    'ஒரே மதிப்பு இரு நெடுவரிசைகளில் வருகிறது. பெரும்பாலான வங்கிப் பதிவேற்றங்கள் அதை நிராகரிக்கும்.',
  'config.impact.payoutTemplate.unknown-field': 'ஒரு நெடுவரிசை கொடுப்பனவு வரியில் இல்லாத ஒன்றைக் குறிக்கிறது.',
  'config.impact.payoutTemplate.missing-label':
    'ஒரு நெடுவரிசைக்குத் தலைப்பு இல்லை, தலைப்புகள் இயக்கத்தில் உள்ளன. அதை நிரப்பவும், அல்லது தலைப்பு வரியை அணைக்கவும்.',
  'config.impact.payoutTemplateBankColumns':
    '{{count}} நெடுவரிசைகள் வங்கி விவரங்களைக் கொண்டுள்ளன, எனவே காசோலை மற்றும் ரொக்கச் சுற்றுகளில் அவை வெறுமையாக வரும். அது பொதுவாகப் பரவாயில்லை — அந்தச் சுற்றுகளில் அவை நிரம்பியிருக்கும் என எதிர்பார்க்க வேண்டாம்.',

  'config.impact.fallbackLanguageRequired':
    'ஆங்கிலத்தை நீக்க முடியாது. மொழிபெயர்ப்பு விடுபட்டிருக்கும்போது ஒவ்வொரு கட்டுரையும் பக்கமும் அதற்கே பின்வாங்குகிறது.',

  /* ───────────────────────── M15 Users & roles ───────────────────────── */
  /* Every refusal in this module is a version of one failure: a factory locking itself out
     of its own console. The copy has to make that concrete, because "last administrator"
     means nothing until somebody reads what happens if they press on. */
  'users.title': 'பயனர்கள் மற்றும் பதவிகள்',
  'users.subtitle':
    'கன்சோலைப் பயன்படுத்தக்கூடியவர் யார், மேலும் ஒவ்வொரு பதவியும் செய்யக்கூடியது என்ன',
  'users.views': 'பயனர்கள் அல்லது பதவிகள்',
  'users.view.users': 'நபர்கள்',
  'users.view.roles': 'ஒவ்வொரு பதவியும் செய்யக்கூடியது',
  'users.you': '(நீங்கள்)',
  'users.searchPlaceholder': 'பெயர் அல்லது மின்னஞ்சலைத் தேடவும்',
  'users.filter.all': 'அனைவரும்',
  'users.column.person': 'நபர்',
  'users.column.roles': 'பதவிகள்',
  'users.column.lastSignIn': 'இறுதியாக உள்நுழைந்தது',
  'users.status.active': 'இயக்கத்தில்',
  'users.status.suspended': 'இடைநிறுத்தப்பட்டது',
  'users.neverSignedIn': 'ஒருபோதும் இல்லை',
  'users.lastAdministrator': 'மீண்டும் உள்ளே வர உள்ள ஒரே வழி',
  'users.mfaOwed': 'இரு-காரணி அமைக்கப்படவில்லை',
  'users.noDeleteHint':
    'கணக்குகள் இடைநிறுத்தப்படுகின்றன, ஒருபோதும் அழிக்கப்படுவதில்லை — கொடுப்பனவை அனுமதித்த அல்லது மாதத்தை நிறைவு செய்த நபர் அந்தப் பதிவுகளில் பெயரிடப்பட்டுள்ளார், மேலும் ஆசிரியரைக் கண்டுபிடிக்க முடியாத பதிவு சான்று அல்ல.',

  'users.edit': 'திருத்து',
  'users.suspend': 'இடைநிறுத்து',
  'users.reactivate': 'மீண்டும் இயக்கு',
  'users.resetMfa': 'இரு-காரணியை மீட்டமை',
  'users.invite': 'பயனர் ஒருவரைச் சேர்',
  'users.inviteTitle': 'பயனர் ஒருவரைச் சேர்',
  'users.inviteBody':
    'அவர்கள் இந்த மின்னஞ்சல் முகவரியுடன் உள்நுழைவார்கள். எதுவும் தானாக அனுப்பப்படாது — அவர்களின் கடவுச்சொல்லை நீங்களே அவர்களுக்குக் கூறுங்கள்.',
  'users.editTitle': '{{name}} ஐத் திருத்து',
  'users.editBody':
    'பதவிகளை மாற்றுவது அவர்கள் அடுத்த முறை திரையை ஏற்றும்போது செய்யக்கூடியதை மாற்றும்.',
  'users.field.name': 'முழுப் பெயர்',
  'users.field.email': 'மின்னஞ்சல்',
  'users.field.emailHint':
    'இதன் வழியாகவே அவர்கள் உள்நுழைவார்கள், மேலும் பின்னர் இதை மாற்ற முடியாது.',
  'users.field.emailLocked':
    'மின்னஞ்சல் முகவரியை மாற்ற முடியாது — இந்த நபர் ஏற்கெனவே அனுமதித்த ஒவ்வொன்றிலும் உள்ள பெயர் அதுவே.',
  'users.field.roles': 'பதவிகள்',
  'users.field.rolesHint':
    'ஒன்றுக்கு மேற்பட்டவை இருப்பதில் தவறில்லை. பதவிகள் முரண்படும்போது, அதிகம் அனுமதிக்கும் ஒன்று செயல்படும்.',
  'users.cannotEditOwnRoles':
    'உங்கள் சொந்தப் பதவிகளை நீங்களே மாற்ற முடியாது. வேறு நிர்வாகியைக் கேட்கவும் — ஒரு வேலையை பாதியில் நிறுத்தி யாரோ தம்மையே வெளியில் பூட்டிக்கொள்வதைத் தடுப்பது இதுவே.',
  'users.mfaObligation':
    'இந்த நபர் உள்ளே வருவதற்கு முன் இரு-காரணி உள்நுழைவை அமைத்துக்கொள்ள வேண்டியிருக்கும். மேலாளர்களுக்கும் நிர்வாகிகளுக்கும் அது அவசியம்.',
  'users.created': '{{name}} இப்போது உள்நுழையலாம்',
  'users.createdHint':
    'அவர்களின் கடவுச்சொல்லை அவர்களுக்குக் கூறுங்கள். அவர்களின் பதவிக்குத் தேவைப்பட்டால் இரு-காரணியை அமைக்கக் கேட்கப்படுவார்கள்.',
  'users.confirmCreateBody':
    'தேர்ந்தெடுக்கப்பட்ட பதவிகளுடன் புதிய கன்சோல் கணக்கு ஒன்று உருவாக்கப்படும்.',
  'users.confirmEditBody': 'இந்தப் பயனரின் கணக்கு விவரங்களும் அணுகலும் புதுப்பிக்கப்படும்.',
  'users.createFailed': 'பயனர் உருவாக்கப்படவில்லை',
  'users.updated': '{{name}} புதுப்பிக்கப்பட்டது',
  'users.updateFailed': 'எதுவும் மாற்றப்படவில்லை',

  'users.suspendTitle': '{{name}} ஐ இடைநிறுத்தவா?',
  'users.suspendBody':
    'யாரோ அவர்களை மீண்டும் இயக்கும் வரை அவர்கள் உள்நுழைய முடியாது. அவர்கள் ஏற்கெனவே செய்த அனைத்தும் அப்படியே இருக்கும்.',
  'users.suspendConfirm': 'அவர்களை இடைநிறுத்து',
  'users.suspendDone': '{{name}} இனி உள்நுழைய முடியாது',
  'users.suspendFailed': 'எதுவும் மாற்றப்படவில்லை',
  'users.reactivateTitle': '{{name}} ஐ மீண்டும் இயக்கவா?',
  'users.reactivateBody': 'அவர்களுக்கு இருந்த பதவிகளுடனேயே அவர்கள் உடனே மீண்டும் உள்நுழையலாம்.',
  'users.reactivateConfirm': 'அவர்களை மீண்டும் இயக்கு',
  'users.reactivateDone': '{{name}} மீண்டும் உள்நுழையலாம்',
  'users.reactivateFailed': 'எதுவும் மாற்றப்படவில்லை',
  'users.mfaTitle': '{{name}} க்கான இரு-காரணியை மீட்டமைக்கவா?',
  'users.mfaBody':
    'யாரோ தமது தொலைபேசியை இழந்தபோது இதைப் பயன்படுத்தவும். அவர்கள் அடுத்த முறை உள்நுழையும்போது அதை மீண்டும் அமைத்துக்கொள்வார்கள் — அதுவரை, அவர்களின் கடவுச்சொல் மட்டுமே அவர்களை உள்ளே கொண்டு வரும். நீங்கள் யாருடன் பேசுகிறீர்கள் என்று உறுதியாக இருக்கும்போது மட்டும் இதைச் செய்யவும்.',
  'users.mfaConfirm': 'மீட்டமை',
  'users.mfaDone': '{{name}} க்கான இரு-காரணி மீட்டமைக்கப்பட்டது',
  'users.mfaFailed': 'எதுவும் மாற்றப்படவில்லை',
  'users.reasonHint': 'குறைந்தது {{min}} எழுத்துகள். இது நடக்கும் நபர் ஏன் என்று கேட்பார்.',
  'users.confirmActionBody': '{{action}} க்குக் கேட்கப்பட்ட செயல் செய்யப்படும்.',

  'users.role.clerk': 'எழுதுவினைஞர்',
  'users.role.weigher': 'எடை பார்ப்பவர்',
  'users.role.accountant': 'கணக்கர்',
  'users.role.manager': 'மேலாளர்',
  'users.role.editor': 'ஆசிரியர்',
  'users.role.factoryAdmin': 'தொழிற்சாலை நிர்வாகி',
  'users.role.platformAdmin': 'தளத்தின் நிர்வாகி',

  'users.matrixTitle': 'ஒவ்வொரு பதவியும் செய்யக்கூடியது',
  'users.matrixDescription':
    'இங்கே ஒரு பதவியை மாற்றினால் அது அந்தப் பதவி உள்ள அனைவருக்கும் மாறும். எதையும் நிறுவ வேண்டியதில்லை.',
  'users.matrixDefault': 'நிலையான பதவிகள்',
  'users.matrixCustomised': 'இந்தத் தொழிற்சாலைக்காக மாற்றப்பட்டது',
  'users.matrixChanged': 'இறுதியாக {{name}} அவர்களால் {{when}} மாற்றப்பட்டது.',
  'users.matrixWarning':
    'இவை யாரோ அடுத்த முறை திரையை ஏற்றும்போது செயல்படும். ஒரு பதவியை விரிவாக்குவது அந்தப் பதவி உள்ள அனைவருக்கும் அதைத் தரும், இப்போது உள்நுழைந்திருப்பவர்களும் அடங்கும்.',
  'users.matrixReadOnly': 'ஒரு பதவி செய்யக்கூடியதை மாற்றக்கூடியவர் தொழிற்சாலை நிர்வாகி மட்டுமே.',
  'users.capability': 'செய்யக்கூடியது',
  'users.grantFor': '{{role}} க்கான {{capability}}',
  'users.recoveryCapabilityHint':
    'பயனர்களை நிர்வகிக்க யாரையாவது அனுமதிப்பது இதுவே. குறைந்தது ஒரு பதவி இதைத் தக்கவைத்திருக்க வேண்டும், இல்லையேல் யாரும் மீண்டும் உள்ளே வர முடியாது.',
  'users.matrixLockoutTitle': 'அது அனைவரையும் வெளியில் பூட்டிவிடும்',
  'users.matrixLockoutBody':
    'பயனர்களை நிர்வகிக்கக்கூடிய எந்தப் பதவியும் எஞ்சாது, எனவே யாரும் இதை ஒருபோதும் மீண்டும் மாற்ற முடியாது. அதைச் செய்யக்கூடிய குறைந்தது ஒரு பதவியை எஞ்ச விடவும்.',
  'users.roleSaved': '{{role}} புதுப்பிக்கப்பட்டது',
  'users.roleSaveFailed': 'எதுவும் மாற்றப்படவில்லை',

  'users.level.none': '—',
  'users.level.read': 'பார்த்தல்',
  'users.level.write': 'மாற்றுதல்',
  'users.level.approve': 'அனுமதித்தல்',

  'users.capabilityName.suppliers': 'வழங்குநர்கள்',
  'users.capabilityName.deliveries': 'கொழுந்து சேகரிப்பு',
  'users.capabilityName.ratesAndMonthClose': 'விலை மற்றும் மாத நிறைவு',
  'users.capabilityName.billing': 'பில்களும் சேமிப்பும்',
  'users.capabilityName.payouts': 'கொடுப்பனவுகள்',
  'users.capabilityName.creditRequests': 'கடன் வேண்டுகோள்கள்',
  'users.capabilityName.creditAboveThreshold': 'பெரிய கடன் வேண்டுகோள்கள்',
  'users.capabilityName.changeRequests': 'மாற்ற வேண்டுகோள்கள்',
  'users.capabilityName.inquiries': 'வழங்குநர்களின் செய்திகள்',
  'users.capabilityName.content': 'செய்திகளும் பக்கங்களும்',
  'users.capabilityName.flagsAndBranding': 'கட்டமைப்பு',
  'users.capabilityName.usersAndRoles': 'பயனர்கள் மற்றும் பதவிகள்',
  'users.capabilityName.reports': 'அறிக்கைகளும் முகப்புப் பலகையும்',
  'users.capabilityName.auditLog': 'தணிக்கைப் பதிவு',
  'users.capabilityName.tenants': 'மற்ற தொழிற்சாலைகள்',

  /* ───────────────────────────── M16 Reports ───────────────────────────── */
  /* The list is short on purpose and the copy says so: §19.1's warehouse shape is what the
     rest of M16 needs, and §19.1 is not in this repository. */
  'reports.title': 'அறிக்கைகள்',
  'reports.subtitle':
    'நீங்கள் பார்க்கும் ஒவ்வொரு முறையும், பதிவுகளிலிருந்து நேரடியாக எடுக்கப்பட்ட மதிப்புகள்',
  'reports.available': 'அறிக்கைகள்',
  'reports.results': 'முடிவுகள்',
  'reports.rows': 'வரிசைகள்',
  'reports.total': 'மொத்தம்',
  'reports.generatedAt': '{{when}} கணக்கிடப்பட்டது',
  'reports.runsAutomatically': 'மேலே எதை மாற்றினாலும் மதிப்புகள் புதுப்பிக்கப்படும்.',
  'reports.needsParams': 'முதலில் மேலே உள்ள விருப்பங்களைத் தேர்ந்தெடுக்கவும்.',
  'reports.noParams': 'இன்னும் காட்டுவதற்கு எதுவும் இல்லை',
  'reports.noParamsHint': 'அறிக்கை உள்ளடக்க வேண்டியதைத் தேர்ந்தெடுக்கவும்.',
  'reports.empty': 'வரிசைகள் இல்லை',
  'reports.emptyHint': 'நீங்கள் கேட்டதற்குப் பதிவுகளில் எதுவும் பொருந்தவில்லை.',
  'reports.shortListNote':
    'இப்போதைக்கு இந்த நான்கு மட்டுமே. ஒவ்வொன்றும் கன்சோல் ஏற்கெனவே வைத்திருக்கும் பதிவுகளிலிருந்தே உருவாக்கப்பட்டுள்ளது — தொழிற்சாலை கேட்ட மற்ற அறிக்கைகளுக்குத் தனி அறிக்கைத் தரவுத்தளம் தேவை, அது இன்னும் இல்லை.',
  'reports.noExportNote':
    'இன்னும் பதிவிறக்கம் இல்லை. அதுவரை அட்டவணையைத் தேர்ந்தெடுத்து விரிதாளில் ஒட்டிக்கொள்ளலாம்.',

  'reports.name.monthSummary': 'மாதச் சுருக்கம்',
  'reports.description.monthSummary':
    'ஒரு மாதம் ஒரு பார்வையில்: கொழுந்து, விலை, பில்கள் எவ்வளவு ஆனது, மேலும் சேமிப்பாக வைத்திருப்பது எவ்வளவு.',
  'reports.name.leafByCollectionPoint': 'சேகரிப்பு நிலையம் வாரியாகக் கொழுந்து',
  'reports.description.leafByCollectionPoint':
    'மாதத்தின் கொழுந்து எங்கிருந்து வந்தது, மேலும் ஒரு நிலையம் மற்றொன்றுடன் ஒப்பிடும் விதம்.',
  'reports.name.dormantSuppliers': 'நிறுத்திவிட்ட வழங்குநர்கள்',
  'reports.description.dormantSuppliers':
    'சில காலமாகக் கொழுந்து இல்லாத பதிவு செய்யப்பட்ட வழங்குநர்கள் — மேலும் தொழிற்சாலை இன்னும் அவர்களுக்காக வைத்திருப்பது.',
  'reports.name.channelShift': 'காலப்போக்கில் செயலியின் பயன்பாடு',
  'reports.description.channelShift':
    'வழங்குநர்கள் செயலியில் தாமே சமர்ப்பிக்கும் வேண்டுகோள்கள் எத்தனை, அலுவலகம் அவர்களுக்காக உள்ளிடுவது எத்தனை என்பதற்கு எதிராக.',

  'reports.param.dormantMonths': 'குறைந்தது இந்த அளவு காலம் கொழுந்து இல்லை',
  'reports.param.dormantMonthsHint': 'மாதங்கள்.',
  'reports.param.from': 'இதிலிருந்து',
  'reports.param.to': 'இதுவரை',

  'reports.column.metric': 'மதிப்பு',
  'reports.column.value': 'அளவு',
  'reports.column.point': 'சேகரிப்பு நிலையம்',
  'reports.column.kgs': 'கிலோ',
  'reports.column.suppliers': 'வழங்குநர்கள்',
  'reports.column.deliveries': 'எடை பார்த்தல்கள்',
  'reports.column.meanKgs': 'எடை பார்த்தலுக்குச் சராசரி',
  'reports.column.code': 'இலக்கம்',
  'reports.column.name': 'பெயர்',
  'reports.column.lastDelivery': 'இறுதி ஒப்படைப்பு',
  'reports.column.savings': 'வைத்திருக்கும் சேமிப்பு',
  'reports.column.credit': 'செலுத்த வேண்டியது',
  'reports.column.month': 'மாதம்',
  'reports.column.fromApp': 'செயலியிலிருந்து',
  'reports.column.fromOffice': 'கையால் உள்ளிடப்பட்டது',
  'reports.column.total': 'மொத்தம்',
  'reports.column.appShare': 'செயலியின் பங்கு',

  'reports.metric.stage': 'மாதம் உள்ள நிலை',
  'reports.metric.totalKgs': 'கொழுந்து',
  'reports.metric.supplierCount': 'வழங்குநர்கள்',
  'reports.metric.deliveryCount': 'எடை பார்த்தல்கள்',
  'reports.metric.ratePerKg': 'கிலோவுக்கு விலை',
  'reports.metric.extraRatePerKg': 'கிலோவுக்கு மேலதிகம்',
  'reports.metric.billCount': 'பில்கள்',
  'reports.metric.grossTotal': 'மொத்தம்',
  'reports.metric.payableTotal': 'செலுத்த வேண்டியது',
  'reports.metric.savingsTotal': 'வைத்திருக்கும் சேமிப்பு',

  /* ─────────────────────────────── errors ─────────────────────────────── */
  'error.title': 'ஏதோ தவறு நடந்துவிட்டது',
  'error.network':
    'தொழிற்சாலைச் சேவையகத்துடன் தொடர்பு இல்லை. வலையமைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
  'error.timeout': 'சேவையகம் பதில் அளிக்க மிக நீண்ட நேரம் எடுத்தது. மீண்டும் முயற்சிக்கவும்.',
  'error.forbidden': 'உங்கள் பதவி இதை அனுமதிக்கவில்லை.',
  'error.featureDisabled': 'இந்தத் தொழிற்சாலை அந்த வசதியைப் பயன்படுத்துவதில்லை.',
  'error.notFound': 'அந்தப் பதிவு இனி இல்லை.',
  'error.invalid': 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.',
  'error.mfaInvalid': 'அந்தக் குறியீடு சரியல்ல.',
  'error.noteRequired': 'இதைப் பதிவு செய்வதற்கு முன் குறிப்பு ஒன்று அவசியம்.',
  'error.fourEyesViolation': 'இந்தப் பதிவை நீங்கள் உருவாக்கியதால், அதை நீங்களே அனுமதிக்க முடியாது.',
  'error.alreadyDecided': 'வேறு ஒருவர் ஏற்கெனவே இதைத் தீர்மானித்துவிட்டார்.',
  'error.alreadyPublished': 'அந்த மாதம் ஏற்கெனவே வெளியிடப்பட்டுவிட்டது.',
  'error.exceptionsOpen':
    'மாதத்தில் இன்னும் தீர்க்கப்படாத சிக்கல்கள் உள்ளன. வெளியிடுவதற்கு முன் ஒவ்வொன்றையும் தீர்க்கவும்.',
  'error.rateMissing': 'இந்த மாதத்திற்கான ஏல விலை இன்னும் உள்ளிடப்படவில்லை.',
  'error.invalidRate': 'அது தொழிற்சாலை பதிவு செய்யக்கூடிய விலை அல்ல.',
  'error.alreadyResolved': 'வேறு ஒருவர் ஏற்கெனவே இதைத் தீர்த்துவிட்டார்.',
  'error.monthMismatch':
    'வெளியிடப்படும் மாதத்திலிருந்து வேறுபட்ட மாதத்தையே திரை காட்டுகிறது. மீண்டும் ஏற்றிச் சரிபார்க்கவும்.',
  'error.monthLocked': 'அந்த மாதம் வெளியிடப்பட்டுவிட்டதால், அதன் மதிப்புகளை இனி மாற்ற முடியாது.',
  'error.alreadyVoided': 'இந்த ஒப்படைப்பு ஏற்கெனவே இரத்துச் செய்யப்பட்டுவிட்டது.',
  'error.invalidBatch':
    'வரிசைகளில் ஒன்று தொழிற்சாலை பதிவு செய்யக்கூடியது அல்ல. கிலோவைச் சரிபார்க்கவும்.',
  'error.batchTooLarge':
    'ஒரு அமர்வு தாங்கக்கூடியதை விட அது அதிக வரிசைகள். சிலவற்றைப் பதிவு செய்து, பின்னர் தொடரவும்.',
  'error.staleEligibility':
    'இது திறந்திருந்தபோது மதிப்புகள் மாறின. மீண்டும் ஏற்றி அவற்றை மீண்டும் சரிபார்க்கவும்.',
  'error.billsMissing': 'அந்த மாதத்திற்கான பில்கள் இன்னும் உருவாக்கப்படவில்லை.',
  'error.billsStale':
    'பில்கள் உருவாக்கப்பட்ட பின் கொழுந்து மாறியுள்ளது. வெளியிடுவதற்கு முன் அவற்றை மீண்டும் உருவாக்கவும்.',
  'error.billsUnbalanced':
    'சில பில்களின் கழிவு வரிசைகள் அவற்றின் மொத்தத்துடன் பொருந்தவில்லை. தொழிற்சாலை நிர்வாகிக்குத் தெரிவிக்கவும் — எதுவும் உருவாக்கப்படவில்லை.',
  'error.monthNotPublished':
    'அந்த மாதம் இன்னும் வெளியிடப்படவில்லை, எனவே அதன் மதிப்புகள் இன்னும் மாறக்கூடும். அதற்கு எதிராகச் செலுத்துவதற்கு முன் அதை நிறைவு செய்யவும்.',
  'error.runExists':
    'அந்த மாதத்திற்கும் செலுத்தும் முறைக்கும் ஒரு கொடுப்பனவுச் சுற்று ஏற்கெனவே உள்ளது.',
  'error.alreadyApproved': 'அந்தச் சுற்று ஏற்கெனவே விடுவிக்கப்பட்டுவிட்டது.',
  'error.runNotApproved':
    'அந்தச் சுற்று இன்னும் விடுவிக்கப்படவில்லை, எனவே அதில் எதுவும் செலுத்தப்படவில்லை.',
  'error.noPayableLines': 'அந்தச் சுற்றில் செலுத்த வேண்டியது எதுவும் இல்லை.',
  'error.lineNotPayable':
    'அந்த வரிசைக்குச் செலுத்த முடியாது — அது நிறுத்தி வைக்கப்பட்டுள்ளது, அல்லது ஏற்கெனவே செலுத்தப்பட்டுவிட்டது.',
  'error.overCeiling': 'அது இந்த வழங்குநர் அந்த வசதியில் பெறக்கூடியதை விட அதிகம்.',
  'error.fallbackTranslationMissing':
    'ஆங்கிலப் பாடம் இல்லை, எனவே வழங்குநருக்குக் காட்ட எதுவும் இருக்காது. முதலில் அதை எழுதுங்கள்.',
  'error.slugTaken': 'அந்தத் தலைப்புடன் ஒரு கட்டுரை ஏற்கெனவே உள்ளது.',
  'error.contentNotPublished': 'அது செயலில் இல்லை, எனவே நீக்குவதற்கு எதுவும் இல்லை.',
  'error.url': 'சரியான வலை முகவரியை உள்ளிடவும்',
  'error.unknownCategory':
    'செயலி அதைத் தூக்கி எறியும் — அது அறிந்த வகையின் அறிவிப்புகளை மட்டுமே திறக்கிறது.',
  'error.categoryDisabled': 'இந்தத் தொழிற்சாலை அந்த வகை அறிவிப்பை அனுப்புவதில்லை.',
  'error.noRecipients':
    'அந்தப் பிரிவின் எந்தத் தொலைபேசியும் இந்த வகை அறிவிப்பை ஏற்பதில்லை, எனவே எதுவும் சென்றடையாது.',
  'error.pushNotConfigured':
    'இந்தத் தொழிற்சாலைக்கு அறிவிப்புகள் இயக்கப்பட்டுள்ளன ஆனால் இன்னும் எந்த வகையும் அமைக்கப்படவில்லை. அது கட்டமைப்பில் செய்யப்படுகிறது.',
  'error.tenantImmutable':
    'தொழிற்சாலை அடையாளம் வலை முகவரியிலிருந்து வருகிறது, எனவே அதை மாற்ற முடியாது.',
  'error.flagHasRecords':
    'அந்த வசதி தொழிற்சாலை இன்னும் கணக்குக் கொடுக்க வேண்டிய பதிவுகளைத் தாங்கியுள்ளது, எனவே அதை இன்னும் முடக்க முடியாது.',
  'error.pointInUse':
    'அந்தச் சேகரிப்பு நிலையத்தின் கீழ் எடை பார்த்தல்கள் பதியப்பட்டுள்ளன, அதை நீக்க முடியாது.',
  'error.fallbackLanguageRequired':
    'ஆங்கிலத்தை நீக்க முடியாது — ஒவ்வொரு கட்டுரையும் பக்கமும் அதற்கே பின்வாங்குகிறது.',
  'error.lastAdmin':
    'அது பயனர்களை நிர்வகிக்கக்கூடிய யாரும் எஞ்சாத நிலையை உருவாக்கும், எனவே யாரும் அதை மீளச் செய்ய முடியாது. முதலில் வேறு ஒருவருக்கு அந்தப் பதவியைக் கொடுக்கவும்.',
  'error.selfModification':
    'உங்கள் சொந்தக் கணக்கிற்கு அதை நீங்களே செய்ய முடியாது. வேறு நிர்வாகியைக் கேட்கவும்.',
  'error.emailTaken': 'அந்த மின்னஞ்சல் முகவரிக்கு ஏற்கெனவே கணக்கு உள்ளது.',
  'error.unknownRole': 'அப்படி ஒரு பதவி இல்லை.',
  'error.unknown':
    'எதிர்பாராத பிழை. இது தொடர்ந்து நடந்தால், தொழிற்சாலை நிர்வாகிக்குத் தெரிவிக்கவும்.',
  'error.boundaryTitle': 'இந்தத் திரையைக் காட்ட முடியவில்லை',
  'error.boundaryBody':
    'கன்சோலின் மற்ற பகுதி இன்னும் வேலை செய்கிறது. மீண்டும் முயற்சிக்க இந்தப் பக்கத்தை மீண்டும் ஏற்றவும்.',
  'error.reload': 'மீண்டும் ஏற்று',

  /* ───────────────────────────── attachments ───────────────────────────── */
  'attachment.tooLarge': 'அந்தக் கோப்பு 8 MB ஐ விடப் பெரியது',
  'attachment.badType': 'JPEG, PNG, WebP அல்லது PDF கோப்பை இணைக்கவும்',
  'attachment.uploading': 'பதிவேற்றப்படுகிறது…',
  'attachment.remove': 'நீக்கு',
} as const;
