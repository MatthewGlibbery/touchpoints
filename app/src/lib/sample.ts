import type { Blueprint, Question } from '../types/blueprint';

export const SAMPLE_BLUEPRINT: Blueprint = {
  id: 'sample-bp-001',
  name: 'Renew a Driving Licence',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  actors: [
    { id: 'a0', name: 'Resident', color: '#3B82F6', order: 0 },
    { id: 'a1', name: 'DVLA Portal', color: '#8B5CF6', order: 1 },
    { id: 'a2', name: 'Post Office', color: '#F59E0B', order: 2 },
    { id: 'a3', name: 'DVLA Team', color: '#10B981', order: 3 },
  ],

  phases: [
    { id: 'p0', name: 'Awareness', order: 0 },
    { id: 'p1', name: 'Application', order: 1 },
    { id: 'p2', name: 'Payment', order: 2 },
    { id: 'p3', name: 'Processing', order: 3 },
    { id: 'p4', name: 'Delivery', order: 4 },
  ],

  touchpoints: [
    { id: 'tp0', label: 'Reminder letter', type: 'human' },
    { id: 'tp1', label: 'DVLA Portal', type: 'interface' },
    { id: 'tp2', label: 'Email confirmation', type: 'system' },
    { id: 'tp3', label: 'SMS updates', type: 'system' },
    { id: 'tp4', label: 'Post Office counter', type: 'human' },
    { id: 'tp5', label: 'New licence by post', type: 'human' },
  ],

  painPoints: [
    { id: 'pp0', description: 'Photo requirements unclear — rejections cause delays', severity: 'high', actionIds: ['act3'] },
    { id: 'pp1', description: 'Medical declaration confusing for healthy applicants', severity: 'medium', actionIds: ['act4'] },
    { id: 'pp2', description: 'No real-time status tracker after submission', severity: 'high', actionIds: ['act10'] },
    { id: 'pp3', description: '3-week wait with no proactive communication', severity: 'high', actionIds: ['act11'] },
    { id: 'pp4', description: 'Address changes not handled in renewal flow', severity: 'medium', actionIds: ['act5'] },
  ],

  opportunities: [
    { id: 'opp0', description: 'Live photo guidance with camera check', effort: 'medium', actionIds: ['act3'], painPointIds: ['pp0'] },
    { id: 'opp1', description: 'Plain-English medical questions with help text', effort: 'low', actionIds: ['act4'], painPointIds: ['pp1'] },
    { id: 'opp2', description: 'Real-time tracker with estimated completion date', effort: 'high', actionIds: ['act10'], painPointIds: ['pp2'] },
    { id: 'opp3', description: 'Proactive SMS at key milestones', effort: 'low', actionIds: ['act11'], painPointIds: ['pp3'] },
    { id: 'opp4', description: 'Optional digital licence alongside physical', effort: 'unsure', actionIds: ['act14'], painPointIds: [] },
  ] as Blueprint['opportunities'],

  questions: [
    { id: 'q0', text: 'How far in advance do residents typically act on the reminder?', type: 'process', actionIds: ['act0'] },
    { id: 'q1', text: 'What is the photo rejection rate on first submission?', type: 'technical', actionIds: ['act3'] },
    { id: 'q2', text: 'Can medical questions be bypassed for applicants under 70 with no declared conditions?', type: 'process', actionIds: ['act4'] },
    { id: 'q3', text: 'What triggers escalation from automated review to manual caseworker?', type: 'technical', actionIds: ['act11'] },
  ] as Question[],

  actions: [
    // Resident — Awareness
    { id: 'act0', actorId: 'a0', phaseId: 'p0', order: 0,
      label: 'Receives renewal reminder',
      labelDetailed: 'Receives a paper reminder letter 90 days before licence expires, including renewal instructions',
      labelAbstract: 'Notified',
      touchpointIds: ['tp0'], painPointIds: [], opportunityIds: [], questionIds: ['q0'] },
    { id: 'act1', actorId: 'a0', phaseId: 'p0', order: 1,
      label: 'Checks requirements online',
      labelDetailed: 'Visits DVLA website to understand what documents and information are needed',
      labelAbstract: 'Research',
      touchpointIds: ['tp1'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // DVLA Portal — Awareness
    { id: 'act2', actorId: 'a1', phaseId: 'p0', order: 0,
      label: 'Sends automated reminder',
      labelDetailed: 'DVLA system triggers reminder letter 90 days before expiry from licensing database',
      labelAbstract: 'Trigger',
      touchpointIds: ['tp0', 'tp3'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // Resident — Application
    { id: 'act3', actorId: 'a0', phaseId: 'p1', order: 0,
      label: 'Uploads photo',
      labelDetailed: 'Uploads a passport-style photo meeting specific DVLA photo requirements — common source of rejection',
      labelAbstract: 'Photo',
      touchpointIds: ['tp1'], painPointIds: ['pp0'], opportunityIds: ['opp0'], questionIds: ['q1'] },
    { id: 'act4', actorId: 'a0', phaseId: 'p1', order: 1,
      label: 'Completes medical declaration',
      labelDetailed: 'Answers medical questions — many healthy applicants find this confusing and worry about edge cases',
      labelAbstract: 'Medical',
      touchpointIds: ['tp1'], painPointIds: ['pp1'], opportunityIds: ['opp1'], questionIds: ['q2'] },
    { id: 'act5', actorId: 'a0', phaseId: 'p1', order: 2,
      label: 'Reviews and submits form',
      labelDetailed: 'Reviews pre-filled personal details, updates address if needed, and submits application',
      labelAbstract: 'Submit',
      touchpointIds: ['tp1'], painPointIds: ['pp4'], opportunityIds: [], questionIds: [] },

    // DVLA Portal — Application
    { id: 'act6', actorId: 'a1', phaseId: 'p1', order: 0,
      label: 'Validates photo & eligibility',
      labelDetailed: 'Runs automated photo quality check and cross-references applicant details with DVLA database',
      labelAbstract: 'Validate',
      touchpointIds: ['tp1'], painPointIds: [], opportunityIds: [], questionIds: [] },
    { id: 'act7', actorId: 'a1', phaseId: 'p1', order: 1,
      label: 'Pre-fills existing details',
      labelDetailed: 'Retrieves existing licence data to pre-populate the form, reducing manual entry',
      labelAbstract: 'Pre-fill',
      touchpointIds: ['tp1'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // Post Office — Application (alternative channel)
    { id: 'act8', actorId: 'a2', phaseId: 'p1', order: 0,
      label: 'Accepts in-person application',
      labelDetailed: 'Resident visits Post Office with paper form and supporting documents as alternative to online',
      labelAbstract: 'In-person',
      touchpointIds: ['tp4'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // Resident — Payment
    { id: 'act9', actorId: 'a0', phaseId: 'p2', order: 0,
      label: 'Pays fee (£14)',
      labelDetailed: 'Pays the standard renewal fee by debit or credit card via the DVLA secure payment page',
      labelAbstract: 'Pay',
      touchpointIds: ['tp1', 'tp2'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // DVLA Portal — Payment
    { id: 'act10_pay', actorId: 'a1', phaseId: 'p2', order: 0,
      label: 'Processes payment & confirms',
      labelDetailed: 'Processes card payment and sends confirmation email with application reference number',
      labelAbstract: 'Confirm',
      touchpointIds: ['tp2'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // Resident — Processing
    { id: 'act10', actorId: 'a0', phaseId: 'p3', order: 0,
      label: 'Checks application status',
      labelDetailed: 'Attempts to check status online — limited visibility, no estimated completion date shown',
      labelAbstract: 'Wait',
      touchpointIds: ['tp1'], painPointIds: ['pp2'], opportunityIds: ['opp2'], questionIds: [] },

    // DVLA Team — Processing
    { id: 'act11', actorId: 'a3', phaseId: 'p3', order: 0,
      label: 'Reviews application',
      labelDetailed: 'DVLA caseworker manually reviews photo, medical declaration, and flags any issues requiring follow-up',
      labelAbstract: 'Review',
      touchpointIds: [], painPointIds: ['pp3'], opportunityIds: ['opp3'], questionIds: ['q3'] },
    { id: 'act12', actorId: 'a3', phaseId: 'p3', order: 1,
      label: 'Approves or requests more info',
      labelDetailed: 'Approves clean applications or contacts applicant for clarification if photo or medical flagged',
      labelAbstract: 'Decide',
      touchpointIds: ['tp3'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // DVLA Team — Delivery
    { id: 'act13', actorId: 'a3', phaseId: 'p4', order: 0,
      label: 'Prints and dispatches licence',
      labelDetailed: 'Approved licence is printed and dispatched via Royal Mail to the registered address',
      labelAbstract: 'Dispatch',
      touchpointIds: ['tp5'], painPointIds: [], opportunityIds: [], questionIds: [] },

    // DVLA Portal — Delivery
    { id: 'act14', actorId: 'a1', phaseId: 'p4', order: 0,
      label: 'Sends dispatch notification',
      labelDetailed: 'Automated email and SMS sent when licence is dispatched, with expected delivery window',
      labelAbstract: 'Notify',
      touchpointIds: ['tp2', 'tp3'], painPointIds: [], opportunityIds: ['opp4'], questionIds: [] },

    // Resident — Delivery
    {
      id: 'act15', actorId: 'a0', phaseId: 'p4', order: 0,
      label: 'Receives new licence',
      labelDetailed: 'Receives new photocard driving licence by post, destroys old licence',
      labelAbstract: 'Done',
      touchpointIds: ['tp5'], painPointIds: [], opportunityIds: [], questionIds: [] },
  ],
};
