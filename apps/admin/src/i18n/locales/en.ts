/**
 * The console's string table.
 *
 * English-only chrome, by decision (docs/white-label.md → Localization): office
 * staff work in English, while **editorial content is authored in si/en/ta**
 * because a Sinhala supplier reading an English-only FAQ is the app failing.
 *
 * Every label still goes through `t()`. Not ceremony — it is what makes adding
 * Sinhala for the weighing-point clerks in M3 a copy deliverable rather than a
 * refactor of every screen. Flat, dotted keys, matching the mobile app's tables.
 */
export const en = {
  /* ─────────────────────────────── common ─────────────────────────────── */
  'common.appName': 'Console',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.clear': 'Clear',
  'common.retry': 'Try again',
  'common.loading': 'Loading…',
  'common.none': 'None',
  'common.notAvailable': 'Not available',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.of': 'of',
  'common.previous': 'Previous',
  'common.next': 'Next',
  'common.rowsPerPage': 'Rows',
  'common.showing': 'Showing {{from}}–{{to}} of {{total}}',
  // The page controls are icons, so these are the only names they have — they
  // reach the clerk as a tooltip and a screen reader as the accessible name.
  'common.pagination': 'Pages',
  'common.firstPage': 'First page',
  'common.previousPage': 'Previous page',
  'common.nextPage': 'Next page',
  'common.lastPage': 'Last page',
  'common.pageOf': 'Page {{page}} of {{total}}',
  'common.noResults': 'Nothing to show',
  'common.noResultsHint': 'Try a different search or clear the filters.',
  'common.signOut': 'Sign out',
  'shell.signOutConfirmBody': 'You will need to sign in again to continue working in the console.',
  'config.confirmSaveTitle': 'Save these configuration changes?',
  'config.confirmSaveBody': 'These edits affect other modules and branding throughout the factory console.',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.reason': 'Reason',
  'common.note': 'Note',
  'common.actor': 'Who',
  'common.when': 'When',
  'common.status': 'Status',
  'common.actions': 'Actions',
  'common.required': 'Required',
  'common.optional': 'Optional',
  'common.back': 'Back',

  /* ──────────────────────────────── shell ──────────────────────────────── */
  'shell.skipToContent': 'Skip to content',
  'shell.tenantBanner': 'Showing {{tenant}}',
  'shell.degradedConfig':
    'Could not reach the factory configuration — showing bundled defaults. Branding and feature flags may be out of date.',
  'shell.mockBanner':
    'Mock data. Nothing here is a real record, and nothing is saved past a page reload.',
  'shell.tenantSwitcher': 'Tenant (dev/demo only)',

  /* ──────────────────────────────── splash ─────────────────────────────── */
  // The factory's name is the headline on the boot splash; this is the line under
  // it, and it says what is happening rather than naming the product again.
  'splash.subtitle': 'Preparing the office console…',

  /* ──────────────────────────── navigation ──────────────────────────── */
  'nav.dashboard': 'Dashboard',
  'nav.suppliers': 'Suppliers',
  'nav.deliveries': 'Leaf collection',
  'nav.rates': 'Rates & month close',
  'nav.bills': 'Bills',
  'nav.payouts': 'Payouts',
  'nav.credit': 'Credit queues',
  'nav.savings': 'Savings',
  'nav.changeRequests': 'Change requests',
  'nav.inquiries': 'Inquiries',
  'nav.news': 'News',
  'nav.content': 'Static content',
  'nav.notifications': 'Notifications',
  'nav.configuration': 'Configuration',
  'nav.users': 'Users & roles',
  'nav.reports': 'Reports',
  'nav.audit': 'Audit log',
  'nav.sectionOperations': 'Daily work',
  'nav.sectionMoney': 'Money',
  'nav.sectionQueues': 'Queues',
  'nav.sectionContent': 'Content',
  'nav.sectionAdmin': 'Administration',

  /* ──────────────────────────────── auth ──────────────────────────────── */
  'auth.signInTitle': 'Sign in to the console',
  'auth.signInSubtitle': 'Office access for {{factory}}',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signingIn': 'Signing in…',
  'auth.mfaTitle': 'Two-factor code',
  'auth.mfaSubtitle': 'Enter the six-digit code from your authenticator app.',
  'auth.mfaCode': 'Code',
  'auth.mfaVerify': 'Verify',
  'auth.mfaRequiredNote': 'Two-factor authentication is required for manager accounts and above.',
  'auth.forgotPassword': 'Forgotten your password?',
  'auth.forgotPasswordHint':
    'Ask your factory administrator to reset it. The console cannot email a reset link.',
  'auth.supplierWrongPlace': 'Suppliers sign in on the mobile app, not here.',
  'auth.demoCredentials': 'Mock sign-in',
  'auth.demoMfa': '(two-factor: {{code}})',
  'auth.demoRole.clerk': 'Clerk — change requests, suppliers',
  'auth.demoRole.weigher': 'Weigher — records leaf',
  'auth.demoRole.accountant': 'Accountant — rate and month close',
  'auth.demoRole.manager': 'Manager — publishes the month',
  'auth.demoRole.editor': 'Editor — writes news and static content',
  'auth.demoRole.factoryAdmin': 'Factory admin — publishes content',
  'auth.sessionExpired': 'Your session ended. Please sign in again.',

  /* ────────────────────────────── dashboard ────────────────────────────── */
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'The day at a glance',
  'dashboard.queues': 'Queues',
  'dashboard.queueEmpty': 'Nothing waiting',
  /* A queue the server reports that this version of the console has no screen for. Not
     "planned" — every module of the §18.1 scope is built; this is a newer API naming a
     queue this build has never heard of. */
  'dashboard.noScreenForQueue': 'No screen for this in this version',
  'dashboard.oldestWaiting': 'Oldest {{age}}',
  'dashboard.slaBreaching': '{{count}} past target',
  'dashboard.todaysCollection': "Today's leaf",
  'dashboard.todaysSuppliers': '{{count}} suppliers',
  'dashboard.todaysDeliveries': '{{count}} deliveries',
  'dashboard.vsYesterday': '{{value}} vs yesterday',
  'dashboard.monthCycle': 'Month cycle',
  'dashboard.openExceptions': '{{count}} open exceptions',
  'dashboard.noExceptions': 'No open exceptions',
  'dashboard.intakeTrend': 'Leaf intake, last 14 days',
  'dashboard.intakeAxisKg': 'kg',
  'dashboard.alerts': 'Needs attention',
  'dashboard.noAlerts': 'Nothing needs attention',

  /* The §13 cycle stage is read by M1 and M3 alike, so it is not a dashboard
     label. Moved rather than duplicated: two tables for one enum drift. */
  'month.stage.collecting': 'Collecting leaf',
  'month.stage.awaitingRate': 'Awaiting auction result',
  'month.stage.rateEntered': 'Rate entered',
  'month.stage.billsGenerated': 'Bills generated',
  'month.stage.published': 'Published',
  'dashboard.stageHint.awaitingRate':
    'No rate yet for {{month}}, so every rate-derived figure is blank rather than zero.',
  'dashboard.stageHint.published': 'Published {{date}} by {{name}}.',

  'dashboard.queue.changeRequests': 'Change requests',
  'dashboard.queue.advanceRequests': 'Advances',
  'dashboard.queue.loanRequests': 'Loans',
  'dashboard.queue.manureRequests': 'Manure',
  'dashboard.queue.inquiries': 'Inquiries',

  'dashboard.alert.missingBankDetails':
    '{{count}} suppliers have deliveries but no bank details — the month cannot be published until each is resolved.',
  'dashboard.alert.slaBreach': '{{count}} change requests have been waiting longer than 3 days.',
  'dashboard.alert.awaitingRate': 'The auction result for {{month}} has not been entered yet.',

  /* ────────────────────────────── suppliers ────────────────────────────── */
  'suppliers.title': 'Suppliers',
  'suppliers.subtitle': 'The registry',
  'suppliers.searchPlaceholder': 'Search code, name or NIC',
  'suppliers.searchHint': 'A code matches with or without its division, e.g. 5708 or MAKADURA.',
  'suppliers.column.code': 'Code',
  'suppliers.column.name': 'Name',
  'suppliers.column.nic': 'NIC',
  'suppliers.column.point': 'Collection point',
  'suppliers.column.status': 'Status',
  'suppliers.column.payment': 'Paid by',
  'suppliers.column.savings': 'Savings /kg',
  'suppliers.column.lastDelivery': 'Last delivery',
  'suppliers.column.pending': 'Pending',
  'suppliers.status.active': 'Active',
  'suppliers.status.suspended': 'Suspended',
  'suppliers.status.closed': 'Closed',
  'suppliers.payment.cheque': 'Cheque',
  'suppliers.payment.bankTransfer': 'Bank transfer',
  'suppliers.payment.cash': 'Cash',
  'suppliers.filter.allStatuses': 'Any status',
  'suppliers.filter.allPoints': 'Any collection point',
  'suppliers.filter.anyBankDetails': 'Any bank details',
  'suppliers.filter.noBankDetails': 'Missing bank details',
  'suppliers.noBankDetails': 'No bank details',
  'suppliers.optedOut': 'Opted out',

  'suppliers.detail.profile': 'Profile',
  'suppliers.detail.estate': 'Estate',
  'suppliers.detail.payout': 'Payout',
  'suppliers.detail.savings': 'Savings',
  'suppliers.detail.credit': 'Credit',
  'suppliers.detail.activity': 'Activity',
  'suppliers.detail.phone': 'Telephone',
  'suppliers.detail.email': 'Email',
  'suppliers.detail.dateOfBirth': 'Date of birth',
  'suppliers.detail.homeAddress': 'Home address',
  'suppliers.detail.estateAddress': 'Estate address',
  'suppliers.detail.registered': 'Registered',
  'suppliers.detail.bank': 'Bank',
  'suppliers.detail.branch': 'Branch',
  'suppliers.detail.accountNumber': 'Account number',
  'suppliers.detail.savingsRate': 'Savings per kg',
  'suppliers.detail.savingsBalance': 'Savings balance',
  'suppliers.detail.creditAdvance': 'Advance balance',
  'suppliers.detail.creditLoan': 'Loan balance',
  'suppliers.detail.creditManure': 'Manure balance',
  'suppliers.detail.pendingRequests': 'Open requests',
  'suppliers.detail.suspendedBecause': 'Suspended: {{reason}}',
  'suppliers.detail.auditTitle': 'Recent activity on this record',

  'suppliers.action.edit': 'Edit details',
  'suppliers.action.suspend': 'Suspend',
  'suppliers.action.reactivate': 'Reactivate',
  'suppliers.action.reveal': 'Show full number',
  'suppliers.action.resetPassword': 'Reset app password',

  'suppliers.reveal.title': 'Show the full account number',
  'suppliers.reveal.body':
    'This is recorded in the audit log with your name and the reason you give. Show it only when you need it to do something.',
  'suppliers.reveal.reasonLabel': 'Why do you need it?',
  'suppliers.reveal.reasonPlaceholder': 'e.g. Verifying a bank rejection for the July payout run',
  'suppliers.reveal.show': 'Show number',
  'suppliers.reveal.recorded': 'Recorded in the audit log as {{auditId}}.',

  'suppliers.suspend.title': 'Suspend {{name}}',
  'suppliers.suspend.body':
    'A suspended supplier keeps every record. Deliveries and requests stop until they are reactivated.',
  'suppliers.reactivate.title': 'Reactivate {{name}}',
  'suppliers.reactivate.body': 'Deliveries and requests resume immediately.',
  'suppliers.reasonLabel': 'Reason (recorded in the audit log)',

  'suppliers.resetPassword.title': 'Reset app password',
  'suppliers.resetPassword.pending':
    'How the office resets a supplier password — who checks their identity and what the supplier receives — is still an open question with the factory (§21.16). Until it is answered this action is disabled.',

  /* ──────────────────────── M9 change requests ──────────────────────── */
  'changeRequests.title': 'Change requests',
  'changeRequests.subtitle': 'Payout and savings-rate approvals',
  'changeRequests.column.supplier': 'Supplier',
  'changeRequests.column.type': 'Change',
  'changeRequests.column.current': 'Current',
  'changeRequests.column.requested': 'Requested',
  'changeRequests.column.age': 'Waiting',
  'changeRequests.column.channel': 'Raised by',
  'changeRequests.type.bankDetails': 'Bank details',
  'changeRequests.type.paymentMethod': 'Payment method',
  'changeRequests.type.savingsRate': 'Savings rate',
  'changeRequests.status.pending': 'Pending',
  'changeRequests.status.approved': 'Approved',
  'changeRequests.status.rejected': 'Rejected',
  'changeRequests.channel.app': 'Supplier (app)',
  'changeRequests.channel.office': 'Office',
  'changeRequests.filter.pending': 'Pending',
  'changeRequests.filter.approved': 'Approved',
  'changeRequests.filter.rejected': 'Rejected',
  'changeRequests.filter.allTypes': 'Any change',
  'changeRequests.empty': 'The queue is clear',
  'changeRequests.emptyHint': 'Every change request has been decided.',

  'changeRequests.detail.title': 'Change request',
  'changeRequests.detail.comparison': 'Current vs requested',
  'changeRequests.detail.currentHeading': 'Active now',
  'changeRequests.detail.requestedHeading': 'Requested',
  'changeRequests.detail.submitted': 'Submitted {{when}}',
  'changeRequests.detail.waiting': 'Waiting {{age}}',
  'changeRequests.detail.evidence': 'Evidence',
  'changeRequests.detail.addEvidence': 'Attach a file',
  'changeRequests.detail.noEvidence': 'No files attached',
  'changeRequests.detail.decision': 'Decision',
  'changeRequests.detail.decidedBy': '{{status}} by {{name}}, {{when}}',
  'changeRequests.detail.auditTitle': 'Audit trail',
  'changeRequests.detail.supplierLink': 'Open supplier record',

  'changeRequests.approve': 'Approve',
  'changeRequests.reject': 'Reject',
  'changeRequests.approveTitle': 'Approve this change',
  'changeRequests.rejectTitle': 'Reject this change',
  'changeRequests.approveBody':
    "The supplier's app shows the new value on its next refresh, and this decision is recorded with your name.",
  'changeRequests.rejectBody':
    'The current value stays as it is. The supplier sees your note as the reason, so write it for them.',
  'changeRequests.noteLabel': 'Decision note',
  'changeRequests.notePlaceholderApprove': 'e.g. Passbook checked against the NIC at the counter.',
  'changeRequests.notePlaceholderReject':
    'e.g. The account name does not match the registered supplier name. Bring the passbook to the office.',
  'changeRequests.noteHelp': 'The supplier reads this. At least 10 characters.',
  'changeRequests.approved': 'Approved. The app will show the new value on next refresh.',
  'changeRequests.rejected': 'Rejected. The current value is unchanged.',

  'changeRequests.fourEyes.title': 'You cannot decide this one',
  'changeRequests.fourEyes.body':
    'You raised this request on the supplier’s behalf, so someone else has to decide it. Ask a manager or another clerk.',
  'changeRequests.alreadyDecided.title': 'Already decided',
  'changeRequests.alreadyDecided.body':
    'Someone else decided this while the queue was open. Reloading to show what they chose.',

  /* ─────────────────────── M7 Credit queues ─────────────────────── */
  'credit.title': 'Credit queues',
  'credit.subtitle': 'Advances, loans and manure on credit',
  'credit.column.supplier': 'Supplier',
  'credit.column.facility': 'Facility',
  'credit.column.amount': 'Asked for',
  'credit.column.available': 'May draw',
  'credit.column.age': 'Waiting',
  'credit.facility.advance': 'Advance',
  'credit.facility.loan': 'Loan',
  'credit.facility.manure': 'Manure',
  'credit.status.pending': 'Pending',
  'credit.status.approved': 'Approved',
  'credit.status.rejected': 'Rejected',
  'credit.filter.pending': 'Pending',
  'credit.filter.approved': 'Approved',
  'credit.filter.rejected': 'Rejected',
  'credit.filter.allFacilities': 'Any facility',
  'credit.filter.overCeiling': 'Over the ceiling only',
  'credit.requested': 'Asked for',
  'credit.empty': 'The queue is clear',
  'credit.emptyHint': 'Every credit request has been decided.',
  'credit.overCeilingShort': 'Over ceiling',
  'credit.notEligibleShort': 'Not eligible',

  'credit.eligibility.title': 'What this supplier may draw',
  'credit.eligibility.computedAt': 'Worked out {{when}}',
  'credit.eligibility.eligible': 'Eligible',
  'credit.eligibility.notEligible': 'Not eligible',
  'credit.eligibility.ceiling': 'Ceiling',
  'credit.eligibility.outstanding': 'Already drawn',
  'credit.eligibility.available': 'Still available',
  'credit.eligibility.withinCeiling': 'Within the ceiling',
  'credit.eligibility.overBy': 'Over by {{amount}}',
  'credit.eligibility.blocked': 'Why not:',
  'credit.eligibility.working': 'How this was worked out',
  'credit.eligibility.monthsOfHistory': 'Closed months of income',
  'credit.eligibility.historyOf': '{{count}} of {{required}} required',
  'credit.eligibility.historyNotRequired': '{{count}} — not required for an advance',
  'credit.eligibility.averageIncome': 'Average monthly account',
  'credit.eligibility.multiplier': 'Loan multiple',
  'credit.eligibility.lastSettledMonth': 'Last settled month',
  'credit.eligibility.settledRate': 'Rate per kg that priced it',
  'credit.eligibility.pricedKgs.advance': 'This month’s leaf so far',
  'credit.eligibility.pricedKgs.loan': 'Leaf priced',
  'credit.eligibility.pricedKgs.manure': 'Last settled month’s leaf',

  /* The server names the blocker with a key; the copy lives here (BR-110). */
  'credit.reason.shortHistory':
    'The supplier does not yet have enough closed months of income for this facility.',
  'credit.reason.noSettledRate':
    'No month has settled with an auction rate yet, so there is nothing to price a ceiling against.',
  'credit.reason.noLeafThisMonth':
    'No leaf has been recorded this month, and an advance is priced off leaf already delivered.',
  'credit.reason.noCeiling': 'The rule produces no ceiling for this supplier.',
  'credit.reason.fullyDrawn':
    'The supplier has already drawn their whole ceiling on this facility.',

  'credit.detail.title': '{{facility}} · {{amount}}',
  'credit.detail.request': 'The request',
  'credit.detail.reason': 'What the supplier said',
  'credit.detail.manureType': 'Fertilizer',
  'credit.detail.quantity': 'Quantity',
  'credit.detail.decision': 'Decision',
  'credit.detail.decidedAgainst': 'Decided against a ceiling of {{ceiling}}, worked out {{when}}.',
  'credit.detail.auditTitle': 'Audit trail',
  'credit.detail.otherRequests': 'Their other open requests',

  'credit.approve': 'Approve',
  'credit.reject': 'Reject',
  'credit.approveTitle': 'Approve this credit',
  'credit.rejectTitle': 'Reject this request',
  'credit.approveBody':
    'The supplier may draw {{amount}}, and it is added to their {{facility}} balance. It comes back as a deduction on their next account.',
  'credit.rejectBody':
    'Nothing is paid. The supplier sees your note as the reason, so write it for them.',
  'credit.noteLabel': 'Decision note',
  'credit.noteHelp': 'The supplier reads this. At least 10 characters.',
  'credit.notePlaceholderApprove':
    'e.g. Within the ceiling for the leaf already weighed this month. Paying at the counter.',
  'credit.notePlaceholderReject':
    'e.g. Above three times the average monthly account. Reapply once two more months are settled.',
  'credit.approved': 'Approved. It will be deducted from the next account.',
  'credit.rejected': 'Rejected. Nothing has been paid.',

  'credit.managerDecides':
    'A manager decides credit requests. You can read this one and everything behind it, but the approval is not yours to give.',
  'credit.fourEyes.body':
    'You raised this request on the supplier’s behalf, so someone else has to decide it. Credit is money, and money takes four eyes.',
  'credit.overCeiling.title': 'More than they may draw',
  'credit.overCeiling.body':
    'This asks for {{amount}} and only {{available}} is available. It cannot be approved as it stands — reject it, or ask the supplier to raise a smaller one.',
  'credit.stale.title': 'The figures have moved',
  'credit.stale.body':
    'The ceiling changed while this was open — leaf recorded, or a month published. The fresh figures are loading; read them before deciding.',

  /* ─────────────────────────── M10 Inquiries ─────────────────────────── */
  'inquiries.title': 'Inquiries',
  'inquiries.subtitle': 'Messages from suppliers',
  'inquiries.searchPlaceholder': 'Search supplier, subject or message',
  'inquiries.column.subject': 'Message',
  'inquiries.status.open': 'Open',
  'inquiries.status.resolved': 'Answered',
  'inquiries.status.closed': 'Closed',
  'inquiries.filter.open': 'Open',
  'inquiries.filter.resolved': 'Answered',
  'inquiries.filter.closed': 'Closed unanswered',
  'inquiries.empty': 'Nothing waiting',
  'inquiries.emptyHint': 'Every message has been answered or closed.',

  'inquiries.detail.message': 'What the supplier asked',
  'inquiries.detail.reply': 'The answer',
  'inquiries.detail.repliedBy': 'Answered by {{name}}, {{when}}',
  'inquiries.detail.closed': 'Closed unanswered',
  'inquiries.detail.closedBy': 'Closed by {{name}}, {{when}}',
  'inquiries.detail.auditTitle': 'Audit trail',
  'inquiries.detail.history': 'Their earlier messages',
  'inquiries.detail.pushSent':
    'A notification was sent to their phone telling them there is an answer — the reply itself is only in the app, because a lock screen is read by whoever is holding it.',
  'inquiries.detail.pushNotSent':
    'The supplier sees this the next time they open the app. Automatic notifications for answered messages are switched off for this factory, so nothing has been sent to their phone.',

  'inquiries.reply': 'Reply',
  'inquiries.sendReply': 'Send reply',
  'inquiries.close': 'Close unanswered',
  'inquiries.replyTitle': 'Reply to the supplier',
  'inquiries.closeTitle': 'Close without answering',
  'inquiries.replyBody':
    'This is what the supplier reads in the app. Write it to them, not about them.',
  'inquiries.closeBody':
    'Use this for a duplicate, a test message, or something meant for somewhere else. The supplier is not sent an answer.',
  'inquiries.replyLabel': 'Your answer',
  'inquiries.replyHelp': 'The supplier reads this. At least 20 characters.',
  'inquiries.replyPlaceholder':
    'e.g. We checked the 12th and found a second weighing of 96 kg that had not been entered. It is on your account now.',
  'inquiries.closureNoteLabel': 'Why it is being closed',
  'inquiries.closureNoteHelp': 'Only the office sees this. At least 10 characters.',
  'inquiries.closurePlaceholder': 'e.g. Duplicate of the message answered on the 4th.',
  'inquiries.replied': 'Answered. The supplier sees it next time they open the app.',
  'inquiries.closed': 'Closed. No answer was sent.',
  'inquiries.alreadyAnswered.title': 'Already answered',
  'inquiries.alreadyAnswered.body':
    'Someone else answered or closed this while it was open. Reloading to show what they said.',

  /* ─────────────────────────────── audit ─────────────────────────────── */
  'audit.title': 'Audit log',
  'audit.column.when': 'When',
  'audit.column.actor': 'Who',
  'audit.column.action': 'Action',
  'audit.column.entity': 'Record',
  'audit.column.change': 'Change',
  'audit.filter.allEntities': 'Any record type',
  'audit.empty': 'Nothing recorded yet',
  'audit.action.changeRequestApprove': 'Approved a change request',
  'audit.action.changeRequestReject': 'Rejected a change request',
  'audit.action.supplierUpdate': 'Edited a supplier',
  'audit.action.supplierSuspend': 'Suspended a supplier',
  'audit.action.supplierReactivate': 'Reactivated a supplier',
  'audit.action.supplierReveal': 'Viewed a full account number',
  'audit.action.deliveryBatchCommit': 'Recorded a weighing session',
  'audit.action.deliveryVoid': 'Voided a delivery',
  'audit.action.rateSet': 'Entered a monthly rate',
  'audit.action.monthExceptionResolve': 'Resolved a month-close exception',
  'audit.action.monthPublish': 'Published a month',
  'audit.action.billsGenerate': 'Generated a month’s bills',
  'audit.action.payoutRunCreate': 'Prepared a payout run',
  'audit.action.payoutRunApprove': 'Released a payout run',
  'audit.action.payoutLinePaid': 'Recorded a payment',
  'audit.action.payoutLineFailed': 'Recorded a failed payment',
  'audit.action.creditApprove': 'Approved credit',
  'audit.action.creditReject': 'Rejected a credit request',
  'audit.action.inquiryReply': 'Answered a supplier',
  'audit.action.inquiryClose': 'Closed a message unanswered',

  'audit.action.newsCreate': 'Created a news article',
  'audit.action.newsUpdate': 'Edited a news article',
  'audit.action.newsTranslationSave': 'Saved a translation',
  'audit.action.newsPublish': 'Published a news article',
  'audit.action.newsUnpublish': 'Took a news article down',
  'audit.action.newsArchive': 'Archived a news article',
  'audit.action.staticPageSave': 'Edited a static page',
  'audit.action.staticPagePublish': 'Published a static page',

  'audit.action.notificationSend': 'Sent a notification',
  'audit.action.notificationTrigger': 'Changed an automatic notification',

  'audit.action.configUpdate': 'Changed the configuration',
  'audit.action.userCreate': 'Added a console user',
  'audit.action.userUpdate': 'Changed a user’s name or roles',
  'audit.action.userSuspend': 'Suspended a console user',
  'audit.action.userReactivate': 'Reactivated a console user',
  'audit.action.userMfaReset': 'Reset a user’s two-factor sign-in',
  'audit.action.roleUpdate': 'Changed what a role may do',

  /* ───────────────────────────── validation ───────────────────────────── */
  'validation.required': 'This is required',
  'validation.email': 'Enter a valid email address',
  'validation.tooLong': 'That is too long',
  'validation.min': 'Too small',
  'validation.date': 'Enter a valid date',
  'validation.nic': 'Enter a valid NIC (9 digits and V, or 12 digits)',
  'validation.phone': 'Enter a valid Sri Lankan number',
  'validation.supplierCode': 'Enter a code like 5708 or 5708 (MAKADURA)',
  'validation.monthKey': 'Enter a month like 2026-07',
  'validation.ratePositive': 'A rate must be more than 0',
  'validation.rateNonNegative': 'This cannot be negative',
  'validation.rateTooLarge': 'That rate is larger than the factory can record',
  'validation.moneyScale': 'Money takes at most two decimals',
  'validation.mfaCode': 'Enter the six-digit code',
  'validation.noteRequired': 'A note is required',
  'validation.noteTooShort': 'Write at least 10 characters — the supplier reads this',
  'validation.url': 'Enter a valid web address',
  'validation.fallbackRequired': 'The English copy is required — everything falls back to it',
  'validation.reasonRequired': 'A reason is required',
  'validation.replyRequired': 'An answer is required',
  'validation.replyTooShort': 'Write at least 20 characters — this is the answer the supplier reads',

  /* ─────────────────────── M3 Leaf collection ─────────────────────── */
  'deliveries.title': 'Leaf collection',
  'deliveries.subtitle': 'What the factory weighed in, day by day',
  'deliveries.date': 'Day',
  'deliveries.point': 'Collection point',
  'deliveries.allPoints': 'All collection points',
  'deliveries.showVoided': 'Show voided rows',
  'deliveries.pickPointToEnter':
    'Pick a collection point to start recording — a delivery is filed against the point where it was weighed.',
  'deliveries.monthLocked':
    '{{month}} is published, so nothing more can be recorded or voided in it. Bills and payouts are built from the leaf as it stands.',
  'deliveries.empty': 'Nothing weighed yet',
  'deliveries.emptyHint': 'Rows appear here as soon as a weighing session is committed.',

  'deliveries.column.recordedAt': 'Recorded',
  'deliveries.column.supplier': 'Supplier',
  'deliveries.column.point': 'Point',
  'deliveries.column.kgs': 'Kilos',
  'deliveries.column.source': 'Source',
  'deliveries.column.recordedBy': 'Weighed by',
  'deliveries.column.line': 'Line',
  'deliveries.source.manual': 'Keyed in',
  'deliveries.source.scaleFile': 'Scale file',

  'deliveries.totalKgs': 'Total kilos',
  'deliveries.rowCount': 'Deliveries',
  'deliveries.supplierCount': 'Suppliers',

  'deliveries.supplierCode': 'Supplier code',
  'deliveries.supplierCodeHint': 'With or without the division, e.g. 5708 or 5708 (MAKADURA).',
  'deliveries.supplierCodePlaceholder': 'Code, then Tab',
  'deliveries.kgs': 'Kilos',
  'deliveries.addRow': 'Add line',
  'deliveries.removeRow': 'Remove',
  'deliveries.sessionEmpty':
    'Type a supplier code and the kilos, then press Enter. Nothing is recorded until you commit.',
  'deliveries.sessionTable': 'Lines in this weighing session, not yet recorded',
  'deliveries.commit': 'Record {{count}} lines',
  'deliveries.committed': 'Recorded {{count}} deliveries',
  'deliveries.committedTotal': "The day's total is now {{kgs}}.",
  'deliveries.committedPartly': 'Recorded {{accepted}}, refused {{rejected}}',
  'deliveries.committedPartlyHint':
    'The refused lines are still in the grid with the reason on each one. Fix them and record again.',
  'deliveries.commitFailed': 'Nothing was recorded',
  'deliveries.outlierConfirm':
    '{{kgs}} is far more than the rest of this session. Press Enter again to record it as typed.',

  'deliveries.error.sessionFull':
    'A session holds at most {{limit}} lines. Record these, then start another.',
  'deliveries.error.stillMatching': 'Still looking up that code…',
  'deliveries.error.unknownSupplier': 'No active supplier with that code.',
  'deliveries.error.kgRange': 'Kilos must be more than 0 and at most {{max}}.',
  'deliveries.error.kgPrecision':
    'Kilos take at most two decimals — the factory records 12.35, not 12.345.',

  'deliveries.void': 'Void',
  'deliveries.voidedBadge': 'Voided',
  'deliveries.voidTitle': 'Void this delivery',
  'deliveries.voidDescription':
    '{{kgs}} recorded for {{code}} · {{name}}. The row stays in the record with your reason — nothing money-bearing is deleted.',
  'deliveries.voidConfirm': 'Void the delivery',
  'deliveries.voidReasonHint':
    'At least {{min}} characters. The supplier holds a slip for this weighing and may ask.',
  'deliveries.voided': 'Voided {{kgs}}',
  'deliveries.voidFailed': 'The delivery was not voided',

  /* ─────────────────── M4 Rates & month close ─────────────────── */
  'months.title': 'Rates & month close',
  'months.subtitle': 'The auction rate, and what is stopping the month closing',
  'months.pickMonth': 'Month',
  'months.totalKgs': 'Leaf this month',
  'months.suppliers': 'Suppliers',
  'months.perKg': 'per kg',

  'months.rateTitle': 'Auction rate',
  'months.rateDescription': 'What the factory pays per kilo for this month.',
  'months.ratePerKg': 'Rate per kg',
  'months.ratePerKgHint': 'From the auction result.',
  'months.extraRatePerKg': 'Extra per kg',
  'months.extraHint': 'What the factory adds on top. 0 is a real answer.',
  'months.totalPerKg': 'Total per kg',
  'months.saveRate': 'Save the rate',
  'months.updateRate': 'Correct the rate',
  'months.enteredBy': 'Entered by',
  'months.noRateYet':
    'No rate entered for {{month}} yet, so every rate-derived figure in the app is blank rather than zero.',
  'months.rateLocked':
    'This month is published, so the rate is part of the record and cannot be changed.',
  'months.rateReadOnly': 'Only the accountant enters the rate.',
  'months.rateSaved': 'Rate saved for {{month}}',
  'months.rateFailed': 'The rate was not saved',

  'months.error.ratePositive': 'A rate must be more than 0.',
  'months.error.extraNonNegative': 'The extra cannot be negative.',
  'months.error.moneyScale': 'Money takes at most two decimals.',

  'months.closeTitle': 'Month close',
  'months.closeDescription': 'Every step has to pass before the month can be published.',
  'months.closedDescription': 'This month is closed. Its figures are the record now.',
  'months.step.leaf': 'Leaf recorded',
  'months.step.leafDetail': '{{kgs}} from {{suppliers}} suppliers, {{deliveries}} deliveries.',
  'months.step.rate': 'Auction rate entered',
  'months.step.rateDetail': '{{total}} per kg, entered by {{name}}.',
  'months.step.rateMissing': 'No rate yet — bills cannot be built without one.',
  'months.step.exceptions': 'Exceptions resolved',
  'months.step.exceptionsClear': 'All {{total}} resolved.',
  'months.step.exceptionsOpen': '{{count}} still open.',
  'months.step.bills': 'Bills generated',
  'months.step.billsDetail': '{{count}} bills, {{payable}} payable.',
  'months.step.billsMissing': 'No bills built yet — publishing has nothing to hand to suppliers.',
  'months.step.billsStale':
    'The leaf has changed since the bills were built. Re-generate them before closing.',
  'months.step.openBills': 'Open the bill run',
  'months.stepDone': '— done',
  'months.stepBlocked': '— not done yet',
  'months.publish': 'Publish {{month}}',
  'months.blockedHint': 'Finish the steps above first.',
  'months.irreversibleHint':
    'Publishing cannot be undone: the leaf locks, and bills and payouts are built from these figures.',
  'months.fourEyesHint':
    'You entered this month’s rate, so somebody else has to publish it (BR-501).',
  'months.publishNeedsManager': 'Publishing a month is a manager’s decision.',
  'months.alreadyPublished': 'Published by {{name}} on {{date}}.',
  'months.confirmTitle': 'Publish {{month}}?',
  'months.confirmDescription':
    'This cannot be undone. The month’s leaf is locked against further entry, and every bill and payout is built from the figures below.',
  'months.confirmPublish': 'Publish the month',
  'months.publishNoteHint': 'Optional. Anything the office should know about this close.',
  'months.published': 'Published {{month}}',
  'months.publishFailed': 'The month was not published',

  'months.exceptionsTitle': 'Exceptions',
  'months.exceptionsDescription': 'Each one has to be resolved, or explained, before the close.',
  'months.filterExceptions': 'Which exceptions',
  'months.filter.open': 'Open ({{count}})',
  'months.filter.resolved': 'Resolved',
  'months.filter.all': 'All',
  'months.column.type': 'Exception',
  'months.column.supplier': 'Supplier',
  'months.column.detail': 'Detail',
  'months.column.raised': 'Raised',
  'months.exception.missingBankDetails': 'No bank details',
  'months.exception.inactiveSupplierWithLeaf': 'Leaf from an inactive supplier',
  'months.exception.pendingChangeRequest': 'Change request still open',
  'months.exception.outlierDelivery': 'Unusual weighing',
  'months.openRecord': 'Open the record',
  'months.resolve': 'Resolve',
  'months.resolveTitle': 'Resolve this exception',
  'months.resolveConfirm': 'Mark it resolved',
  'months.resolveNoteHint':
    'At least {{min}} characters. This is what an auditor reads when they ask why the month closed with this on it.',
  'months.resolvedByNote': 'Resolved by {{name}}: {{note}}',
  'months.exceptionResolved': 'Exception resolved',
  'months.exceptionResolveFailed': 'The exception was not resolved',
  'months.noOpenExceptions': 'Nothing is blocking the close',
  'months.noOpenExceptionsHint': 'Every exception raised for this month has been resolved.',

  /* ─────────── shared by the money modules (M5, M6, M8) ─────────── */
  'money.pickMonth': 'Month',

  /* ───────────────────────────── M5 Bills ───────────────────────────── */
  'bills.title': 'Bills',
  'bills.subtitle': 'Green Leaf Accounts, checked before the month is published',
  'bills.searchPlaceholder': 'Search code, name or bill number',
  'bills.lensLabel': 'Show',
  'bills.lens.all': 'All bills',
  'bills.lens.missingBankDetails': 'Payable, no bank details',
  'bills.lens.carriesDebt': 'Nothing payable',
  'bills.payableLabel': 'Payable',
  'bills.empty': 'No bills for this month',
  'bills.emptyHint': 'Generate the run once the auction rate has been entered.',

  'bills.column.supplier': 'Supplier',
  'bills.column.billNo': 'Bill no.',
  'bills.column.kgs': 'Kilos',
  'bills.column.gross': 'Gross (LKR)',
  'bills.column.deductions': 'Deductions (LKR)',
  'bills.column.payable': 'Payable (LKR)',
  'bills.flag.unbalanced': 'Does not add up',
  'bills.flag.noBank': 'No bank details',
  'bills.flag.carriesDebt': 'Carries debt',

  'bills.runTitle': 'Bill run',
  'bills.runDescription':
    'A bill is derived from the month’s leaf and its rate. Re-generate whenever either changes.',
  'bills.runDescriptionClosed': 'These bills are the record. Suppliers can see them in the app.',
  'bills.runBills': 'Bills',
  'bills.runKgs': 'Leaf billed',
  'bills.runGross': 'Gross',
  'bills.runDeductions': 'Deductions',
  'bills.runSavings': 'Savings held',
  'bills.runCarryingDebt': 'Nothing payable',
  'bills.runGeneratedBy': 'Generated by {{name}}, {{when}}.',
  'bills.notGenerated':
    'No bills generated for {{month}} yet. The auction rate has to be entered first.',
  'bills.generate': 'Generate the bills',
  'bills.generateHint':
    'Builds one Green Leaf Account per supplier with leaf this month. Nothing is sent to suppliers until the month is published.',
  'bills.regenerate': 'Re-generate the bills',
  'bills.regenerateHint':
    'Recomputes every bill from the leaf and the rate as they stand now. Safe to repeat while the month is open.',
  'bills.generateReadOnly': 'Only the accountant generates bills.',
  'bills.generated': 'Bills generated for {{month}}',
  'bills.generatedDetail': '{{count}} bills, {{payable}} payable.',
  'bills.generateFailed': 'The bills were not generated',
  'bills.missingBankWarning':
    '{{count}} suppliers are owed money with no bank details on file. A payout run will hold those lines until the passbook is collected.',
  'bills.staleWarning':
    'The leaf has changed since these bills were generated ({{kgs}} at the time). Re-generate before publishing — the month cannot close on figures that no longer match.',
  'bills.publishedLock':
    'This month is published, so its bills are the record and cannot be re-generated.',

  'bills.detailTitle': 'Green Leaf Account · {{code}}',
  'bills.detailSubtitle': '{{name}} · {{month}}',
  'bills.backToMonth': 'Back to {{month}}',
  'bills.published': 'Published',
  'bills.draft': 'Not published yet',
  'bills.slipHeader': 'Account',
  'bills.billNo': 'Bill number',
  'bills.month': 'Month',
  'bills.supplier': 'Supplier',
  'bills.issued': 'Generated',
  'bills.factoryRegNo': 'Factory reg. no.',
  'bills.earnings': 'Leaf and rate',
  'bills.noAuctionResult':
    'No auction result for this month, so every rate-derived figure is blank rather than zero.',
  'bills.totalKgs': 'Total kilos',
  'bills.greenLeafAmount': 'Green leaf amount',
  'bills.extraPayment': 'Extra payment',
  'bills.grossAmount': 'Gross amount',

  'bills.deductions': 'Deductions',
  'bills.deductionsPolicy':
    'The nine lines the printed account carries. Which of them the office may set per supplier is still an open question with the factory (§21.10), so none are editable here.',
  'bills.deductionsTotal': 'Total deductions',
  'bills.deduction.transportCharges': 'Transport charges',
  'bills.deduction.tea': 'Tea issued',
  'bills.deduction.savings': 'Savings',
  'bills.deduction.loansAdvance': 'Loan repayment',
  'bills.deduction.advance': 'Advance',
  'bills.deduction.manure': 'Manure',
  'bills.deduction.otherCards': 'Other cards',
  'bills.deduction.stamps': 'Stamps',
  'bills.deduction.previousDebts': 'Previous debts',
  'bills.unbalancedWarning':
    'The deduction lines on this bill do not add up to its stated total (BR-107). Do not publish this month — tell the factory administrator.',

  'bills.balance': 'Balance',
  'bills.balanceDescription': 'The factory pays whole rupees. The coins carry to next month.',
  'bills.balanceAmount': 'Balance amount',
  'bills.coinsBroughtForward': 'Coins brought forward',
  'bills.coinsCarriedForward': 'Coins carried forward',
  'bills.finalBalance': 'Final balance',
  'bills.carriesDebtNotice':
    'Deductions came to more than this month’s account. Nothing is payable, and {{amount}} carries into next month.',
  'bills.noBankNotice':
    'This supplier is owed money and has no bank details on file. A payout run will hold the line.',

  'bills.carryForward': 'Carried into next month',
  'bills.nextMonthDeb': 'Debt carried forward',
  'bills.advanceBalance': 'Advance balance',
  'bills.manureBalance': 'Manure balance',
  'bills.loanInterest': 'Loan interest',

  'bills.savingsDescription': 'Deducted at the supplier’s approved rate and held by the factory.',
  'bills.savingsThisMonth': 'This month',
  'bills.savingsPrevious': 'Previous balance',
  'bills.savingsToDate': 'Balance to date',
  'bills.openPassbook': 'Open the passbook',

  'bills.dailySupply': 'Daily supply',
  'bills.dailySupplyDetail': 'Leaf on {{days}} days, {{kgs}} in total.',

  'bills.correctionsDraft':
    'Nothing here is sent to the supplier until the month is published. Until then, fix a wrong figure at its source — a delivery in Leaf collection, or the rate in Rates & month close — and re-generate.',
  'bills.correctionsPublished':
    'This bill is published, so it is the record. Whether a published bill may be corrected at all, or whether an error is always adjusted on the next account, is still an open question with the factory (§21.8).',

  /* ───────────────────────────── M6 Payouts ───────────────────────────── */
  'payouts.title': 'Payouts',
  'payouts.subtitle': 'Paying a published month, one method at a time',
  'payouts.monthTotal': 'To pay',
  'payouts.monthPaid': 'Paid',
  'payouts.empty': 'No payout runs for this month',
  'payouts.emptyHint': 'Prepare one once the month is published.',

  'payouts.column.method': 'Method',
  'payouts.column.total': 'Total',
  'payouts.column.progress': 'Paid',
  'payouts.column.prepared': 'Prepared by',
  'payouts.column.released': 'Released by',
  'payouts.column.supplier': 'Supplier',
  'payouts.column.amount': 'Amount',
  'payouts.column.account': 'Account',
  'payouts.progress': '{{paid}} of {{total}}',
  'payouts.awaitingApproval': 'Awaiting a manager',
  'payouts.status.draft': 'Draft',
  'payouts.status.approved': 'Released',
  'payouts.status.completed': 'Completed',
  'payouts.heldCount': '{{count}} held',
  'payouts.failedCount': '{{count}} failed',

  'payouts.prepareTitle': 'Prepare a run',
  'payouts.prepareDescription':
    'One run per payment method: a bank file, a cheque list and a cash sheet are three different jobs.',
  'payouts.method': 'Payment method',
  'payouts.prepare': 'Prepare the run',
  'payouts.prepareHint':
    'Builds a line for every supplier on this method who is owed money. Nothing is paid until a manager releases it.',
  'payouts.prepareReadOnly': 'Only the accountant prepares a payout run.',
  'payouts.prepared': '{{method}} run prepared',
  'payouts.preparedDetail': '{{lines}} payable, {{held}} held.',
  'payouts.prepareFailed': 'The run was not prepared',
  'payouts.notPublished':
    '{{month}} is not published yet. A payout run needs a closed month — until then the figures can still change, and money that has left the factory cannot be taken back.',
  'payouts.noBills': 'No bills have been generated for {{month}}, so there is nothing to pay against.',
  'payouts.allMethodsPrepared': 'Every payment method already has a run for this month.',
  'payouts.noFileExport':
    'No bank file yet. What format the factory’s bank accepts — SLIPS, CEFTS or its own CSV — and whether cheques print on pre-printed stock is still an open question (§21.17), so the run gives you the list, the total and somewhere to record what the bank did with it.',

  'payouts.runTitle': '{{method}} · {{month}}',
  'payouts.runSubtitle': '{{lines}} payable lines, {{total}} in total',
  'payouts.backToMonth': 'Back to {{month}}',
  'payouts.releaseTitle': 'Release',
  'payouts.releaseDescription':
    'Nothing in this run has been paid. A manager releases it, and it cannot be the person who prepared it.',
  'payouts.releasedDescription': 'This run has been released. Record what the bank did, line by line.',
  'payouts.stat.payable': 'Payable',
  'payouts.stat.paid': 'Paid',
  'payouts.stat.failed': 'Failed',
  'payouts.stat.held': 'Held',
  'payouts.heldExplanation':
    '{{count}} lines are held: the supplier is owed money and has no account to pay it into. They stay on this run and count against nothing until the passbook is collected — the run can still complete without them.',
  'payouts.preparedBy': 'Prepared by {{name}}, {{when}}',
  'payouts.releasedBy': 'released by {{name}}, {{when}}',
  'payouts.release': 'Release {{total}}',
  'payouts.releaseHint': 'Releasing records that the money has been sent for payment.',
  'payouts.releaseNeedsManager': 'Releasing a payout run is a manager’s decision.',
  'payouts.fourEyesHint':
    'You prepared this run, so somebody else has to release it (BR-501).',
  'payouts.nothingPayableHint': 'Every line in this run is held. There is nothing to release.',
  'payouts.approvedNotice': 'Released. Mark each line as the bank answers.',
  'payouts.completedNotice': 'Every line accounted for, {{when}}.',
  'payouts.confirmReleaseTitle': 'Release this run?',
  'payouts.confirmReleaseBody':
    'This records that the factory has sent these payments. Check the total against what you are about to give the bank.',
  'payouts.confirmRelease': 'Release the run',
  'payouts.releaseNoteHint': 'Optional. Anything the office should know about this run.',
  'payouts.approved': 'Run released — {{total}}',
  'payouts.approveFailed': 'The run was not released',

  'payouts.linesTitle': 'Lines',
  'payouts.linesDescription': 'Held and unpaid first — those are the ones still to work.',
  'payouts.filterLines': 'Which lines',
  'payouts.filter.all': 'All lines',
  'payouts.filter.held': 'Held ({{count}})',
  'payouts.filter.pending': 'Not yet paid',
  'payouts.filter.failed': 'Failed',
  'payouts.filter.paid': 'Paid',
  'payouts.noLinesHint': 'No lines match that filter.',
  'payouts.line.pending': 'Not yet paid',
  'payouts.line.held': 'Held',
  'payouts.line.paid': 'Paid',
  'payouts.line.failed': 'Failed',

  'payouts.markPaid': 'Paid',
  'payouts.markFailedShort': 'Failed',
  'payouts.markPaidTitle': 'Record this payment',
  'payouts.markPaidBody': 'Only mark a line paid once the money has actually left the account.',
  'payouts.markFailedTitle': 'Record a failed payment',
  'payouts.markFailedBody':
    'The supplier has not been paid. Write what happened — whoever picks this run up next works from your note.',
  'payouts.reasonLabel': 'What went wrong',
  'payouts.reasonHint': 'At least {{min}} characters, e.g. what the bank returned.',
  'payouts.confirmPaid': 'Mark it paid',
  'payouts.confirmFailed': 'Mark it failed',
  'payouts.markedPaid': '{{code}} marked paid',
  'payouts.markedFailed': '{{code}} marked failed',
  'payouts.markFailed': 'The line was not updated',

  /* ───────────────────────────── M8 Savings ───────────────────────────── */
  'savings.title': 'Savings',
  'savings.subtitle': 'What the factory holds on suppliers’ behalf',
  'savings.balanceTotal': 'Held for suppliers',
  'savings.contributedThisMonth': 'Added in {{month}}',
  'savings.schemeTitle': 'The scheme',
  'savings.schemeDescription':
    'A supplier chooses a rate per kilo, it is deducted from their monthly account, and the factory holds it.',
  'savings.stat.accounts': 'Accounts',
  'savings.stat.optedOut': 'Opted out',
  'savings.stat.contributing': 'Contributed this month',
  'savings.stat.averagePerKg': 'Average per kg',
  'savings.trendTitle': 'Savings by month',
  'savings.column.month': 'Month',
  'savings.column.contributed': 'Added (LKR)',
  'savings.column.heldAfter': 'Held after (LKR)',
  'savings.column.rate': 'Rate /kg',
  'savings.column.balance': 'Balance (LKR)',
  'savings.column.lastContribution': 'Last added',
  'savings.column.source': 'From',
  'savings.column.amount': 'Amount (LKR)',
  'savings.liabilityNote':
    'This is suppliers’ money, not factory income. A contribution is created by publishing a month — it is the savings line on a published bill — so there is nothing to add or edit here.',

  'savings.accountsTitle': 'Savings accounts',
  'savings.searchPlaceholder': 'Search code or name',
  'savings.filterLabel': 'Show',
  'savings.filter.any': 'All accounts',
  'savings.filter.contributing': 'Contributing',
  'savings.filter.optedOut': 'Opted out',
  'savings.contributing': 'Contributing',
  'savings.neverContributed': 'Never',
  'savings.pendingRateChange': 'Rate change pending',

  'savings.ledgerTitle': 'Passbook · {{code}} {{name}}',
  'savings.ledgerSubtitle': 'Balance {{balance}} · {{rate}} per kg',
  'savings.ledgerTable': 'Savings movements, oldest first',
  'savings.source.openingBalance': 'Opening balance',
  'savings.source.billDeduction': 'Bill deduction',
  'savings.source.adjustment': 'Adjustment',
  'savings.source.withdrawal': 'Withdrawal',
  'savings.source.interest': 'Interest',
  'savings.noLedger': 'Nothing in this passbook yet',
  'savings.noLedgerHint':
    'A movement appears here when a month is published with a savings deduction on this supplier’s bill.',
  'savings.withdrawalsPending':
    'No withdrawals or interest. Whether a supplier may withdraw at all — on what notice, and whether the factory pays interest — is still an open question with the factory (§21.9), and moving somebody’s savings on a guessed rule is not something the console will do.',

  /* ─────────── M11 News · M12 Static content (shared) ─────────── */
  /* AC-08 lives in this block: a missing translation must be visible to the editor,
     and every string below exists to say *what the gap costs* rather than that one
     exists. "Sinhala missing" is a fact; "a Sinhala supplier is reading English right
     now" is the thing that gets it fixed. */
  'content.languages': 'Languages',
  'content.language.si': 'Sinhala',
  'content.language.en': 'English',
  'content.language.ta': 'Tamil',
  'content.fallbackLanguageHint': 'The language everything falls back to. It cannot be left empty.',
  'content.state.missing': '— not written yet',
  'content.state.stale': '— older than the English copy',

  'content.copyTitle': 'Copy',
  'content.copyDescription': 'One language at a time. Saving one language does not touch the others.',
  'content.field.title': 'Title',
  'content.field.titleHint': 'What the supplier sees in the list.',
  'content.field.excerpt': 'Summary',
  'content.field.excerptHint': 'One line, shown under the title in the feed. Optional.',
  'content.field.body': 'Body',
  'content.field.bodyHint': 'Plain text. Line breaks are kept.',
  'content.translateFrom': 'Translating from {{language}}',
  'content.save': 'Save {{language}}',
  'content.saved': '{{language}} saved',
  'content.saveFailed': 'That copy was not saved',
  'content.saveNeedsCopy': 'A title and a body are needed before this can be saved.',
  'content.unsaved': 'Unsaved changes. Switching language will lose them.',
  'content.savedAt': 'Saved {{when}} by {{name}}.',
  'content.notWrittenYet': 'Nothing written in this language yet.',
  'content.readOnly': 'Only an editor can change content.',
  'content.lastEditedBy': 'Last edited by {{name}}, {{when}}',
  'content.auditTitle': 'Changes to this record',

  'content.gap.complete': 'Written in every language this factory publishes in.',
  'content.gap.fallbackMissing':
    'There is no {{language}} copy, so there is nothing to show a supplier in any language. This cannot be published until it is written.',
  'content.gap.missingLive':
    'Live with no copy in {{languages}}. Suppliers reading in those languages are being shown the {{fallback}} version right now.',
  'content.gap.missingDraft': 'Not written yet in {{languages}}.',
  'content.gap.stale':
    'The {{languages}} copy is older than the English it was translated from. The app shows it as though it were current, so nothing looks wrong to the supplier.',
  'content.badge.missing': '{{count}} missing',
  'content.badge.stale': '{{count}} out of date',
  'content.badge.gaps': '{{count}} to fix',
  'content.column.languages': 'Languages',
  'content.column.lastEdit': 'Last edit',
  'content.complete': 'Complete',
  'content.lens': 'Show',

  'content.previewTitle': 'What the supplier sees',
  'content.previewDescription': 'Resolved the way the app resolves it, for a reader in {{language}}.',
  'content.previewFallback':
    'There is no {{requested}} copy, so a {{requested}} reader is shown the {{fallback}} version.',
  'content.previewEmpty': 'Nothing to show',
  'content.previewEmptyHint':
    'There is no copy in any language yet, so the app would have nothing to render.',

  /* ───────────────────────────── M11 News ───────────────────────────── */
  'news.title': 'News',
  'news.subtitle': 'The feed suppliers read in the app',
  'news.searchPlaceholder': 'Search titles and copy, in any language',
  'news.untitled': 'Untitled article',
  'news.backToList': 'Back to news',
  'news.column.title': 'Article',
  'news.column.published': 'Published',
  'news.status.draft': 'Draft',
  'news.status.published': 'Live',
  'news.status.archived': 'Archived',
  'news.lens.all': 'All articles',
  'news.lens.incomplete': 'Live with a gap',
  'news.empty': 'No articles yet',
  'news.emptyHint': 'Anything published here appears in the app’s news feed.',
  'news.noIncomplete': 'Nothing live is missing a translation',
  'news.noIncompleteHint':
    'Every published article is written in each language this factory publishes in.',

  'news.create': 'New article',
  'news.createTitle': 'New article',
  'news.createDescription':
    'Write the English copy first — it is what every other language falls back to until it is translated.',
  'news.createDraftHint': 'It is created as a draft. Nothing reaches suppliers until it is published.',
  'notifications.confirmSendBody': 'This message will be sent to {{count}} device(s) immediately.',
  'notifications.confirmSendHint': 'A send cannot be recalled once it is sent.',
  'staticContent.publishConfirmTitle': 'Publish {{page}}?',
  'staticContent.publishConfirmBody': 'This makes the page live for suppliers immediately.',
  'news.createConfirm': 'Create the draft',
  'news.created': 'Draft created',
  'news.createdHint': 'Add the other languages, then publish.',
  'news.createFailed': 'The article was not created',

  'news.lifecycleTitle': 'Publishing',
  'news.lifecycleDraft': 'Nothing here has reached a supplier yet.',
  'news.lifecyclePublished': 'This is live in the app.',
  'news.publishedBy': 'Published by {{name}}, {{when}}.',
  'news.publish': 'Publish',
  'news.unpublish': 'Take it down',
  'news.archive': 'Archive',
  'news.published': 'Published — it is in the app’s feed now',
  'news.unpublished': 'Taken down. It is no longer in the feed.',
  'news.archived': 'Archived',
  'news.publishFailed': 'The article was not published',
  'news.unpublishFailed': 'The article was not taken down',
  'news.archiveFailed': 'The article was not archived',
  'news.publishNeedsAdmin': 'Publishing is the factory administrator’s decision.',
  'news.noDeleteHint':
    'Articles are archived, never deleted — a supplier may have read one and may ask about it.',
  'news.confirm.publishTitle': 'Publish this article?',
  'news.confirm.publishBody': 'It appears in the app’s feed for every supplier immediately.',
  'news.confirm.publishAction': 'Publish it',
  'news.confirm.publishWithGaps':
    'You can publish with languages missing — the app falls back to English — but those suppliers will read it in English until it is translated.',
  'news.confirm.unpublishTitle': 'Take this down?',
  'news.confirm.unpublishBody':
    'It leaves the feed. Suppliers who already read it keep what they read; the copy is not deleted.',
  'news.confirm.unpublishAction': 'Take it down',
  'news.confirm.archiveTitle': 'Archive this article?',
  'news.confirm.archiveBody':
    'It leaves the feed and the working list, and stays in the record. Nothing is deleted.',
  'news.confirm.archiveAction': 'Archive it',

  /* ───────────────────── M12 Static content ───────────────────── */
  'staticContent.title': 'Static content',
  'staticContent.subtitle': 'The app’s fixed pages',
  'staticContent.pagesTitle': 'Pages',
  'staticContent.page.faq': 'Frequently asked questions',
  'staticContent.page.savingsScheme': 'The savings scheme',
  'staticContent.page.creditTerms': 'Credit terms',
  'staticContent.page.about': 'About the factory',
  'staticContent.page.terms': 'Terms of supply',
  'staticContent.page.privacy': 'Privacy',
  'staticContent.status.draft': 'Not published',
  'staticContent.status.published': 'Live',
  'staticContent.notWritten': 'Never written',
  'staticContent.draftDescription':
    'This page has never been published, so the app shows its own built-in version.',
  'staticContent.liveDescription': 'Live since {{when}}, published by {{name}}.',
  'staticContent.publish': 'Publish this page',
  'staticContent.publishHint':
    'After this, saving an edit puts it in front of suppliers straight away — there is no second step.',
  'staticContent.publishNeedsCopy': 'Write the {{language}} copy first.',
  'staticContent.publishNeedsAdmin': 'Publishing is the factory administrator’s decision.',
  'staticContent.published': '{{page}} is live',
  'staticContent.publishFailed': 'The page was not published',
  'staticContent.editsAreLive':
    'This page is live. An edit reaches suppliers as soon as it is saved — every change is recorded in the audit log with the previous wording.',
  'staticContent.savedLive': 'Suppliers see this now.',

  /* ───────────────────────── M13 Notifications ───────────────────────── */
  /* §21.24 is unanswered — whether the office composes every send or whether
     bill-published fires off the publish step. The console does both and makes the
     choice a toggle, so the copy here has to explain a *mechanism* rather than assert
     a policy. */
  'notifications.title': 'Notifications',
  'notifications.subtitle': 'What suppliers have been told, and what the factory tells them automatically',
  'notifications.compose': 'Write a notification',

  'notifications.category.billPublished': 'Account published',
  'notifications.category.requestDecided': 'Request decided',
  'notifications.category.newsArticle': 'News article',
  'notifications.category.inquiryReplied': 'Message answered',
  'notifications.event.billPublished': 'Fires when a month is published in Rates & month close.',
  'notifications.event.requestDecided': 'Fires when a change request is approved or rejected.',
  'notifications.event.newsArticle': 'Fires when a news article is published.',
  'notifications.event.inquiryReplied': 'Fires when the office replies to a message.',

  'notifications.triggersTitle': 'Automatic notifications',
  'notifications.triggersDescription':
    'Sent by the system when something happens, with nobody pressing anything.',
  'notifications.on': 'On',
  'notifications.off': 'Off',
  'notifications.notConfigured': 'Not set up for this factory',
  'notifications.triggerChanged': 'Changed by {{name}}, {{when}}.',
  'notifications.triggerOn': '{{category}} will now be sent automatically',
  'notifications.triggerOff': '{{category}} will no longer be sent automatically',
  'notifications.triggerFailed': 'That setting was not changed',
  'notifications.triggersNeedAdmin':
    'Only the factory administrator can change what is sent automatically.',
  'notifications.openQuestion':
    'Whether the office writes every message by hand or the system sends them automatically is still an open question with the factory (§21.24). Until it is answered, both work and these switches are the answer — no code change is needed to settle it.',

  'notifications.column.message': 'Message',
  'notifications.column.category': 'Kind',
  'notifications.column.audience': 'Sent to',
  'notifications.column.reach': 'Reached',
  'notifications.firedBy': 'Sent automatically',
  'notifications.composedBy': 'Written by {{name}}',
  'notifications.reachedDevices': '{{count}} phones',
  'notifications.optedOutDevices': '{{count}} opted out',
  'notifications.audience.allSuppliers': 'Every supplier',
  'notifications.audience.collectionPoint': '{{point}} only',
  'notifications.audience.supplier': 'One supplier',
  'notifications.filterLabel': 'Show',
  'notifications.filter.all': 'All notifications',
  'notifications.filter.automatic': 'Sent automatically',
  'notifications.filter.composed': 'Written by the office',
  'notifications.empty': 'Nothing has been sent yet',
  'notifications.emptyHint':
    'Automatic notifications appear here as they fire, and anything the office writes appears alongside them.',
  'notifications.noDeliveryReports':
    'A phone never reports back, so these are the figures at the moment of sending — not proof anybody read it.',
  'notifications.useNewsHint':
    'A notification is a headline, not an article. Anything longer belongs in',

  'notifications.composeTitle': 'Write a notification',
  'notifications.composeDescription':
    'This appears on every supplier’s lock screen in the audience you choose.',
  'notifications.field.category': 'Kind',
  'notifications.field.categoryHint':
    'Decides which screen the app opens. The app ignores anything it does not recognise, so this is not cosmetic.',
  'notifications.field.categoryPlaceholder': 'Choose a kind',
  'notifications.field.audience': 'Send to',
  'notifications.field.pickPoint': 'Choose a collection point',
  'notifications.audienceKind.allSuppliers': 'Every supplier',
  'notifications.audienceKind.collectionPoint': 'One collection point',
  'notifications.field.title': 'Title',
  'notifications.field.titleHint': 'At most {{max}} characters — a lock screen cuts the rest.',
  'notifications.field.body': 'Message',
  'notifications.field.bodyHint': 'At most {{max}} characters. Say the whole thing here.',
  'notifications.reachLoading': 'Working out who this reaches…',
  'notifications.reachSummary': 'Reaches {{devices}} phones, across {{suppliers}} suppliers.',
  'notifications.reachSuppressed':
    '{{count}} phones have “{{category}}” switched off and will not get this.',
  'notifications.reachNoDevice': '{{count}} suppliers in this audience have never installed the app.',
  'notifications.reachNobody':
    'Nobody in this audience would receive it. Put it on the noticeboard instead, or choose a different kind.',
  'notifications.noRecallHint':
    'A notification cannot be taken back, and nothing reports whether a phone showed it.',
  'notifications.send': 'Send it',
  'notifications.sendToCount': 'Send to {{count}} phones',
  'notifications.sent': 'Sent to {{count}} phones',
  'notifications.sentSuppressed': '{{count}} phones have this kind switched off and did not get it.',
  'notifications.sendFailed': 'Nothing was sent',

  /* ───────────────────────── M14 Configuration ───────────────────────── */
  /* AC-12 lives in this block: "a new factory goes live without a code deploy". The copy
     has to explain *consequences*, because every edit here reaches across modules the
     reader cannot see from this screen. */
  'configuration.title': 'Configuration',
  'configuration.subtitle': 'Everything about this factory that is data rather than code',
  'config.tenantId': 'Factory id',
  'config.readOnlyBadge': 'Read only',
  'config.readOnly': 'Only the factory administrator can change the configuration.',
  'config.sections': 'Settings',
  'config.save': 'Save this section',
  'config.saved': 'Configuration saved',
  'config.savedHint': 'The change is live everywhere in the console — no reload needed.',
  'config.saveFailed': 'Nothing was saved',
  'config.revert': 'Undo changes',
  'config.unsavedHint': 'Unsaved changes in this section.',
  'config.nothingToSave': 'Nothing has changed.',
  'config.blockedHint': 'Fix the problem above before saving.',
  'config.remove': 'Remove',
  'config.inUse': 'used by {{count}}',
  'config.listEmpty': 'Nothing here yet.',
  'config.ac12Note':
    'This screen is the whole of setting a factory up. A new factory needs a web address and the settings on this page — no new version of the console, and nothing for a developer to do.',

  'config.section.factory': 'The factory',
  'config.sectionHint.factory': 'Name, registration, contact',
  'config.sectionDescription.factory':
    'What appears on the printed Green Leaf Account and in the app’s help screens.',
  'config.section.features': 'Features',
  'config.sectionHint.features': 'What this factory offers',
  'config.sectionDescription.features':
    'Turning a feature off removes it completely — the menu row, the screens, and the app.',
  'config.section.operations': 'Collection & payment',
  'config.sectionHint.operations': 'Points, banks, savings rates',
  'config.sectionDescription.operations':
    'The lists the weighing points, the payout runs and the savings scheme choose from.',
  'config.section.appearance': 'Languages & branding',
  'config.sectionHint.appearance': 'Languages, logo, colours',
  'config.sectionDescription.appearance':
    'Which languages content is written in, and how the console and the app look.',
  'config.section.push': 'Notifications',
  'config.sectionHint.push': 'What may be sent',
  'config.sectionDescription.push':
    'Which kinds of notification this factory can send, and which a new phone accepts.',

  'config.factory.name': 'Factory name',
  'config.factory.nameHint': 'Appears on every account and in the app.',
  'config.factory.regNo': 'Registration number',
  'config.factory.regNoHint': 'Printed on the Green Leaf Account.',
  'config.factory.telephone': 'Telephone',
  'config.factory.location': 'Location',
  'config.factory.supportEmail': 'Office email',
  'config.factory.supportHours': 'Office hours',
  'config.factory.legalFooter': 'Legal footer',
  'config.factory.legalFooterHint': 'The small print at the foot of a printed account.',

  'config.flagGates': 'Removes {{module}} from the console and the app.',
  'config.flag.enableSavings': 'Savings scheme',
  'config.flag.enableAdvances': 'Advances against leaf',
  'config.flag.enableLoans': 'Loans against income history',
  'config.flag.enableManure': 'Fertilizer on credit',
  'config.flag.enableInquiry': 'Supplier messages',
  'config.flag.enableNews': 'News feed',
  'config.flag.enablePushNotifications': 'Notifications',
  'config.flag.enablePromoBanner': 'Promotional banner',
  'config.flag.enablePayouts': 'Payout runs',
  'config.flag.enableReports': 'Reports',

  'config.points': 'Collection points',
  'config.addPoint': 'Add a point',
  'config.banks': 'Banks',
  'config.addBank': 'Add a bank',
  'config.branchesOf': 'Branches of {{bank}}',
  'config.addBranch': 'Add a branch',
  'config.savingsRates': 'Savings rates a supplier may choose (LKR per kg)',
  'config.addRate': 'Add a rate',

  'config.contentLanguages': 'Languages content is written in',
  'config.contentLanguagesHint':
    'News articles and the app’s fixed pages are written in each of these. A language that is not ticked stops being counted as missing.',
  'config.fallbackRequired': '— required',
  'config.recordsWritten': '{{count}} records written',
  'config.defaultLanguage': 'Default language in the app',
  'config.defaultLanguageHint': 'What a supplier sees before they choose one.',
  'config.logoUrl': 'Logo address',
  'config.logoUrlHint': 'A web address. Left empty, the bundled tea mark is used.',
  'config.faviconUrl': 'Browser icon address',
  'config.colour.primary': 'Main colour',
  'config.colour.secondary': 'Second colour',

  'config.topicPrefix': 'Notification topic prefix',
  'config.topicPrefixHint': 'Technical. Only change this if the messaging provider asks you to.',
  'config.pushCategories': 'Kinds of notification this factory sends',
  'config.pushCategoriesHint':
    'Only a ticked kind can be sent at all. The second box is whether a phone accepts it without the supplier turning it on.',
  'config.optedInByDefault': 'accepted by default',
  'config.pushFlagOff':
    'Notifications are switched off for this factory, so nothing here has any effect yet. Turn them on under Features first.',

  /* The impact list. Each of these is why a change is refused or worth thinking about —
     rendered from the same `configImpact` the API refuses with, so the two can never
     name different things. */
  'config.impact.savingsHeld':
    '{{count}} suppliers have money in the savings scheme. Turning it off would hide balances the factory is holding for them, so this cannot be saved.',
  'config.impact.payoutRunsOpen':
    '{{count}} payout runs are not finished. Turning payouts off would hide money that has not been paid out yet, so this cannot be saved.',
  'config.impact.creditOutstanding':
    'Suppliers still owe LKR {{amount}} on {{facility}}. Turning it off would hide that, so this cannot be saved.',
  'config.impact.surfaceRemoved':
    'Everyone loses this from the menu straight away, and the app stops offering it.',
  'config.impact.pointInUse':
    '{{count}} weighings are filed against {{point}}. Removing it would leave them pointing at a place that no longer exists, so this cannot be saved.',
  'config.impact.bankInUse':
    '{{count}} suppliers are paid through {{bank}}. Their details keep the name; it just stops being offered for new ones.',
  'config.impact.languageDropped': 'No content is written in {{lang}}, so nothing is lost.',
  'config.impact.languageDroppedWithCopy':
    '{{count}} records are written in {{lang}}. The copy stays, but it stops being counted as missing — so nothing will tell you it is out of date.',
  'config.impact.fallbackLanguageRequired':
    'English cannot be removed. Every article and page falls back to it when a translation is missing.',

  /* ───────────────────────── M15 Users & roles ───────────────────────── */
  /* Every refusal in this module is a version of one failure: a factory locking itself out
     of its own console. The copy has to make that concrete, because "last administrator"
     means nothing until somebody reads what happens if they press on. */
  'users.title': 'Users & roles',
  'users.subtitle': 'Who can use the console, and what each role may do',
  'users.views': 'Users or roles',
  'users.view.users': 'People',
  'users.view.roles': 'What each role may do',
  'users.you': '(you)',
  'users.searchPlaceholder': 'Search name or email',
  'users.filter.all': 'Everyone',
  'users.column.person': 'Person',
  'users.column.roles': 'Roles',
  'users.column.lastSignIn': 'Last signed in',
  'users.status.active': 'Active',
  'users.status.suspended': 'Suspended',
  'users.neverSignedIn': 'Never',
  'users.lastAdministrator': 'Only way back in',
  'users.mfaOwed': 'Two-factor not set up',
  'users.noDeleteHint':
    'Accounts are suspended, never deleted — a person who approved a payout or closed a month is named on those records, and a record whose author cannot be found is not evidence.',

  'users.edit': 'Edit',
  'users.suspend': 'Suspend',
  'users.reactivate': 'Reactivate',
  'users.resetMfa': 'Reset two-factor',
  'users.invite': 'Add a user',
  'users.inviteTitle': 'Add a user',
  'users.inviteBody':
    'They sign in with this email address. Nothing is sent automatically — tell them their password yourself.',
  'users.editTitle': 'Edit {{name}}',
  'users.editBody': 'Changing roles changes what they can do the next time they load a screen.',
  'users.field.name': 'Full name',
  'users.field.email': 'Email',
  'users.field.emailHint': 'This is how they sign in, and it cannot be changed afterwards.',
  'users.field.emailLocked':
    'An email address cannot be changed — it is the name on everything this person has already approved.',
  'users.field.roles': 'Roles',
  'users.field.rolesHint':
    'More than one is fine. Where roles disagree, the most permissive one applies.',
  'users.cannotEditOwnRoles':
    'You cannot change your own roles. Ask another administrator — this is what stops somebody locking themselves out halfway through a job.',
  'users.mfaObligation':
    'This person will have to set up two-factor sign-in before they can get in. It is required for managers and administrators.',
  'users.created': '{{name}} can now sign in',
  'users.createdHint': 'Tell them their password. They will be asked to set up two-factor if their role needs it.',
  'users.confirmCreateBody': 'This will create a new console account with the selected roles.',
  'users.confirmEditBody': 'This will update the account details and access for this user.',
  'users.createFailed': 'The user was not created',
  'users.updated': '{{name}} updated',
  'users.updateFailed': 'Nothing was changed',

  'users.suspendTitle': 'Suspend {{name}}?',
  'users.suspendBody':
    'They cannot sign in until somebody reactivates them. Everything they have already done stays exactly as it is.',
  'users.suspendConfirm': 'Suspend them',
  'users.suspendDone': '{{name}} can no longer sign in',
  'users.suspendFailed': 'Nothing was changed',
  'users.reactivateTitle': 'Reactivate {{name}}?',
  'users.reactivateBody': 'They can sign in again immediately, with the roles they had.',
  'users.reactivateConfirm': 'Reactivate them',
  'users.reactivateDone': '{{name}} can sign in again',
  'users.reactivateFailed': 'Nothing was changed',
  'users.mfaTitle': 'Reset two-factor for {{name}}?',
  'users.mfaBody':
    'Use this when somebody has lost their phone. They will set it up again next time they sign in — and until they do, their password alone gets them in. Only do this when you are certain who you are talking to.',
  'users.mfaConfirm': 'Reset it',
  'users.mfaDone': 'Two-factor reset for {{name}}',
  'users.mfaFailed': 'Nothing was changed',
  'users.reasonHint': 'At least {{min}} characters. The person this happens to will ask why.',
  'users.confirmActionBody': 'This will perform the requested action for {{action}}.',

  'users.role.clerk': 'Clerk',
  'users.role.weigher': 'Weigher',
  'users.role.accountant': 'Accountant',
  'users.role.manager': 'Manager',
  'users.role.editor': 'Editor',
  'users.role.factoryAdmin': 'Factory administrator',
  'users.role.platformAdmin': 'Platform administrator',

  'users.matrixTitle': 'What each role may do',
  'users.matrixDescription':
    'Change a role here and it changes for everybody who has it. Nothing needs installing.',
  'users.matrixDefault': 'Standard roles',
  'users.matrixCustomised': 'Changed for this factory',
  'users.matrixChanged': 'Last changed by {{name}}, {{when}}.',
  'users.matrixWarning':
    'These take effect the next time somebody loads a screen. Widening a role gives it to everybody who has that role, including people who are signed in right now.',
  'users.matrixReadOnly': 'Only the factory administrator can change what a role may do.',
  'users.capability': 'Can do',
  'users.grantFor': '{{capability}} for {{role}}',
  'users.recoveryCapabilityHint':
    'This is the one that lets somebody manage users. At least one role must keep it, or nobody can get back in.',
  'users.matrixLockoutTitle': 'That would lock everybody out',
  'users.matrixLockoutBody':
    'No role would be left able to manage users, so nobody could ever change this back. Leave at least one role able to.',
  'users.roleSaved': '{{role}} updated',
  'users.roleSaveFailed': 'Nothing was changed',

  'users.level.none': '—',
  'users.level.read': 'See',
  'users.level.write': 'Change',
  'users.level.approve': 'Approve',

  'users.capabilityName.suppliers': 'Suppliers',
  'users.capabilityName.deliveries': 'Leaf collection',
  'users.capabilityName.ratesAndMonthClose': 'Rates & month close',
  'users.capabilityName.billing': 'Bills & savings',
  'users.capabilityName.payouts': 'Payouts',
  'users.capabilityName.creditRequests': 'Credit requests',
  'users.capabilityName.creditAboveThreshold': 'Large credit requests',
  'users.capabilityName.changeRequests': 'Change requests',
  'users.capabilityName.inquiries': 'Supplier messages',
  'users.capabilityName.content': 'News & pages',
  'users.capabilityName.flagsAndBranding': 'Configuration',
  'users.capabilityName.usersAndRoles': 'Users & roles',
  'users.capabilityName.reports': 'Reports & dashboard',
  'users.capabilityName.auditLog': 'Audit log',
  'users.capabilityName.tenants': 'Other factories',

  /* ───────────────────────────── M16 Reports ───────────────────────────── */
  /* The list is short on purpose and the copy says so: §19.1's warehouse shape is what the
     rest of M16 needs, and §19.1 is not in this repository. */
  'reports.title': 'Reports',
  'reports.subtitle': 'Figures pulled straight from the records, every time you look',
  'reports.available': 'Reports',
  'reports.results': 'Results',
  'reports.rows': 'Rows',
  'reports.total': 'Total',
  'reports.generatedAt': 'Worked out {{when}}',
  'reports.runsAutomatically': 'Change anything above and the figures update.',
  'reports.needsParams': 'Choose the options above first.',
  'reports.noParams': 'Nothing to show yet',
  'reports.noParamsHint': 'Choose what the report should cover.',
  'reports.empty': 'No rows',
  'reports.emptyHint': 'Nothing in the records matches what you asked for.',
  'reports.shortListNote':
    'Only these four for now. Each one is built from records the console already keeps — the rest of the reports the factory asked for need a separate reporting database, which does not exist yet.',
  'reports.noExportNote':
    'No download yet. You can select the table and paste it into a spreadsheet in the meantime.',

  'reports.name.monthSummary': 'Month summary',
  'reports.description.monthSummary':
    'One month at a glance: leaf, rate, what the bills came to, and what is being held as savings.',
  'reports.name.leafByCollectionPoint': 'Leaf by collection point',
  'reports.description.leafByCollectionPoint':
    'Where the month’s leaf came from, and how one point compares with another.',
  'reports.name.dormantSuppliers': 'Suppliers who have stopped',
  'reports.description.dormantSuppliers':
    'Registered suppliers with no leaf for a while — and what the factory still holds for them.',
  'reports.name.channelShift': 'App use over time',
  'reports.description.channelShift':
    'How many requests suppliers make themselves in the app, against how many the office keys in for them.',

  'reports.param.dormantMonths': 'No leaf for at least',
  'reports.param.dormantMonthsHint': 'Months.',
  'reports.param.from': 'From',
  'reports.param.to': 'To',

  'reports.column.metric': 'Figure',
  'reports.column.value': 'Value',
  'reports.column.point': 'Collection point',
  'reports.column.kgs': 'Kilos',
  'reports.column.suppliers': 'Suppliers',
  'reports.column.deliveries': 'Weighings',
  'reports.column.meanKgs': 'Average per weighing',
  'reports.column.code': 'Code',
  'reports.column.name': 'Name',
  'reports.column.lastDelivery': 'Last delivery',
  'reports.column.savings': 'Savings held',
  'reports.column.credit': 'Owes',
  'reports.column.month': 'Month',
  'reports.column.fromApp': 'From the app',
  'reports.column.fromOffice': 'Keyed in',
  'reports.column.total': 'Total',
  'reports.column.appShare': 'From the app',

  'reports.metric.stage': 'Where the month is',
  'reports.metric.totalKgs': 'Leaf',
  'reports.metric.supplierCount': 'Suppliers',
  'reports.metric.deliveryCount': 'Weighings',
  'reports.metric.ratePerKg': 'Rate per kg',
  'reports.metric.extraRatePerKg': 'Extra per kg',
  'reports.metric.billCount': 'Bills',
  'reports.metric.grossTotal': 'Gross',
  'reports.metric.payableTotal': 'Payable',
  'reports.metric.savingsTotal': 'Savings held',

  /* ─────────────────────────────── errors ─────────────────────────────── */
  'error.title': 'Something went wrong',
  'error.network': 'No connection to the factory server. Check the network and try again.',
  'error.timeout': 'The server took too long to answer. Try again.',
  'error.forbidden': 'Your role does not allow this.',
  'error.featureDisabled': 'This factory does not use that feature.',
  'error.notFound': 'That record no longer exists.',
  'error.invalid': 'Email or password is incorrect.',
  'error.mfaInvalid': 'That code is not correct.',
  'error.noteRequired': 'A note is required before this can be recorded.',
  'error.fourEyesViolation': 'You raised this record, so you cannot approve it.',
  'error.alreadyDecided': 'Someone else has already decided this.',
  'error.alreadyPublished': 'That month was already published.',
  'error.exceptionsOpen':
    'The month still has open exceptions. Resolve each one before publishing.',
  'error.rateMissing': 'The auction rate has not been entered for this month yet.',
  'error.invalidRate': 'That is not a rate the factory can record.',
  'error.alreadyResolved': 'Someone else has already resolved this.',
  'error.monthMismatch':
    'The screen is showing a different month from the one being published. Reload and check.',
  'error.monthLocked': 'That month is published, so its figures can no longer be changed.',
  'error.alreadyVoided': 'This delivery was already voided.',
  'error.invalidBatch':
    'One of the lines is not something the factory can record. Check the kilos.',
  'error.batchTooLarge':
    'That is more lines than one session can carry. Record some, then continue.',
  'error.staleEligibility': 'The figures changed while this was open. Reload and check them again.',
  'error.billsMissing': 'The bills for that month have not been generated yet.',
  'error.billsStale':
    'The leaf has changed since the bills were generated. Re-generate them before publishing.',
  'error.billsUnbalanced':
    'Some bills have deduction lines that do not add up to their total. Tell the factory administrator — nothing has been generated.',
  'error.monthNotPublished':
    'That month is not published yet, so its figures can still change. Close it before paying against it.',
  'error.runExists': 'A payout run for that month and payment method already exists.',
  'error.alreadyApproved': 'That run has already been released.',
  'error.runNotApproved': 'That run has not been released yet, so nothing in it has been paid.',
  'error.noPayableLines': 'There is nothing payable in that run.',
  'error.lineNotPayable': 'That line cannot be paid — it is held, or it has already been paid.',
  'error.overCeiling': 'That is more than this supplier may draw on that facility.',
  'error.fallbackTranslationMissing':
    'There is no English copy, so there would be nothing to show a supplier. Write it first.',
  'error.slugTaken': 'An article with that title already exists.',
  'error.contentNotPublished': 'That is not live, so there is nothing to take down.',
  'error.url': 'Enter a valid web address',
  'error.unknownCategory':
    'The app would throw that away — it only opens notifications of a kind it recognises.',
  'error.categoryDisabled': 'This factory does not send that kind of notification.',
  'error.noRecipients':
    'No phone in that audience accepts this kind of notification, so nothing would arrive.',
  'error.pushNotConfigured':
    'Push is switched on for this factory but no kinds have been set up yet. That is done in Configuration.',
  'error.tenantImmutable': 'The factory id comes from the web address and cannot be changed.',
  'error.flagHasRecords':
    'That feature is holding records the factory still has to account for, so it cannot be turned off yet.',
  'error.pointInUse':
    'That collection point has weighings filed against it and cannot be removed.',
  'error.fallbackLanguageRequired':
    'English cannot be removed — every article and page falls back to it.',
  'error.lastAdmin':
    'That would leave nobody able to manage users, so nobody could undo it. Give somebody else the role first.',
  'error.selfModification': 'You cannot do that to your own account. Ask another administrator.',
  'error.emailTaken': 'That email address already has an account.',
  'error.unknownRole': 'There is no such role.',
  'error.unknown': 'Unexpected error. If it keeps happening, tell the factory administrator.',
  'error.boundaryTitle': 'This screen could not be shown',
  'error.boundaryBody': 'The rest of the console still works. Reload this page to try again.',
  'error.reload': 'Reload',

  /* ───────────────────────────── attachments ───────────────────────────── */
  'attachment.tooLarge': 'That file is larger than 8 MB',
  'attachment.badType': 'Attach a JPEG, PNG, WebP or PDF',
  'attachment.uploading': 'Uploading…',
  'attachment.remove': 'Remove',
} as const;

export type TranslationKey = keyof typeof en;
