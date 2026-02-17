import { PrismaClient, UserRole, MeetingStatus, TodoStatus, TodoPriority, RecordingStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data (in reverse order of dependencies)
  console.log('🧹 Cleaning existing data...')
  await prisma.meetingRecording.deleteMany()
  await prisma.todo.deleteMany()
  await prisma.calendarEvent.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.systemSettings.deleteMany()

  // Create departments
  console.log('📁 Creating departments...')
  const departments = await Promise.all([
    prisma.department.create({ data: { name: 'Engineering' } }),
    prisma.department.create({ data: { name: 'Design' } }),
    prisma.department.create({ data: { name: 'Marketing' } }),
    prisma.department.create({ data: { name: 'Sales' } }),
    prisma.department.create({ data: { name: 'Operations' } }),
    prisma.department.create({ data: { name: 'Human Resources' } }),
  ])

  const [engineering, design, marketing, sales, operations, hr] = departments
  console.log(`   ✅ Created ${departments.length} departments`)

  // Create Super Admin (Owner)
  console.log('👑 Creating Super Admin...')
  const superAdmin = await prisma.user.create({
    data: {
      email: 'nishant@test.com',
      name: 'Nishant Rana',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  })

  // Create Reporters (Team Leads / Pod Leaders)
  console.log('👔 Creating Reporters...')
  const reporters = await Promise.all([
    prisma.user.create({
      data: {
        email: 'hiten@test.com',
        name: 'Hiten Shah',
        role: UserRole.REPORTER,
        departmentId: engineering.id,
        reportsToId: superAdmin.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'priya.lead@test.com',
        name: 'Priya Mehta',
        role: UserRole.REPORTER,
        departmentId: design.id,
        reportsToId: superAdmin.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'raj@test.com',
        name: 'Raj Patel',
        role: UserRole.REPORTER,
        departmentId: marketing.id,
        reportsToId: superAdmin.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'anita@test.com',
        name: 'Anita Sharma',
        role: UserRole.REPORTER,
        departmentId: sales.id,
        reportsToId: superAdmin.id,
        isActive: true,
      },
    }),
  ])

  // Create Test Reporter
  const testReporter = await prisma.user.create({
    data: {
      email: 'test-reporter@test.com',
      name: 'Test Reporter',
      role: UserRole.REPORTER,
      departmentId: engineering.id,
      reportsToId: superAdmin.id,
      isActive: true,
    },
  })
  reporters.push(testReporter)

  const [hitenReporter, priyaReporter, rajReporter, anitaReporter] = reporters
  console.log(`   ✅ Created ${reporters.length} reporters`)

  // Create Employees
  console.log('👥 Creating Employees...')
  const employeesData = [
    // Engineering team (reports to Hiten)
    { email: 'ritesh@test.com', name: 'Ritesh Kumar', dept: engineering, reportsTo: hitenReporter },
    { email: 'sneha@test.com', name: 'Sneha Verma', dept: engineering, reportsTo: hitenReporter },
    { email: 'vikram@test.com', name: 'Vikram Singh', dept: engineering, reportsTo: hitenReporter },
    { email: 'deepak@test.com', name: 'Deepak Joshi', dept: engineering, reportsTo: hitenReporter },
    { email: 'kavita@test.com', name: 'Kavita Nair', dept: engineering, reportsTo: hitenReporter },
    
    // Design team (reports to Priya)
    { email: 'amit.design@test.com', name: 'Amit Desai', dept: design, reportsTo: priyaReporter },
    { email: 'neha@test.com', name: 'Neha Gupta', dept: design, reportsTo: priyaReporter },
    { email: 'rohan@test.com', name: 'Rohan Kapoor', dept: design, reportsTo: priyaReporter },
    
    // Marketing team (reports to Raj)
    { email: 'pooja@test.com', name: 'Pooja Sharma', dept: marketing, reportsTo: rajReporter },
    { email: 'karan@test.com', name: 'Karan Malhotra', dept: marketing, reportsTo: rajReporter },
    { email: 'divya@test.com', name: 'Divya Reddy', dept: marketing, reportsTo: rajReporter },
    
    // Sales team (reports to Anita)
    { email: 'sanjay@test.com', name: 'Sanjay Agarwal', dept: sales, reportsTo: anitaReporter },
    { email: 'meera@test.com', name: 'Meera Iyer', dept: sales, reportsTo: anitaReporter },
    { email: 'arjun@test.com', name: 'Arjun Khanna', dept: sales, reportsTo: anitaReporter },
    
    // Team members reporting to Test Reporter
    { email: 'alex@test.com', name: 'Alex Johnson', dept: engineering, reportsTo: testReporter },
    { email: 'sarah@test.com', name: 'Sarah Williams', dept: engineering, reportsTo: testReporter },
    { email: 'mike@test.com', name: 'Mike Chen', dept: engineering, reportsTo: testReporter },
    { email: 'emily@test.com', name: 'Emily Davis', dept: engineering, reportsTo: testReporter },
    { email: 'james@test.com', name: 'James Wilson', dept: engineering, reportsTo: testReporter },
    
    // Test users for login testing (no reportsTo - will trigger onboarding)
    { email: 'test-employee@test.com', name: 'Test Employee', dept: engineering, reportsTo: null },
    { email: 'new-user@test.com', name: 'New User', dept: null, reportsTo: null },
  ]

  const employees: Array<{ id: string; email: string; name: string }> = []
  for (const emp of employeesData) {
    const user = await prisma.user.create({
      data: {
        email: emp.email,
        name: emp.name,
        role: UserRole.EMPLOYEE,
        departmentId: emp.dept?.id || null,
        reportsToId: emp.reportsTo?.id || null,
        isActive: true,
      },
    })
    employees.push(user)
  }
  console.log(`   ✅ Created ${employees.length} employees`)

  // Get specific employees for creating meetings
  const ritesh = employees.find(e => e.email === 'ritesh@test.com')!
  const sneha = employees.find(e => e.email === 'sneha@test.com')!
  const vikram = employees.find(e => e.email === 'vikram@test.com')!
  const amit = employees.find(e => e.email === 'amit.design@test.com')!
  const pooja = employees.find(e => e.email === 'pooja@test.com')!
  
  // Test Reporter's team
  const alex = employees.find(e => e.email === 'alex@test.com')!
  const sarah = employees.find(e => e.email === 'sarah@test.com')!
  const mike = employees.find(e => e.email === 'mike@test.com')!
  const emily = employees.find(e => e.email === 'emily@test.com')!
  const james = employees.find(e => e.email === 'james@test.com')!
  const sanjay = employees.find(e => e.email === 'sanjay@test.com')!

  // Create Meetings
  console.log('📅 Creating meetings...')
  const now = new Date()
  
  // Helper function to create dates
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const meetings = await Promise.all([
    // Completed meetings with form data
    prisma.meeting.create({
      data: {
        employeeId: ritesh.id,
        reporterId: hitenReporter.id,
        meetingDate: daysAgo(14),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Had a wonderful Diwali celebration with family. Feeling refreshed and energized.',
        checkInProfessional: 'Successfully deployed the new payment gateway integration. The team worked really well together.',
        priorityGoalProfessional: 'Master advanced React patterns and TypeScript generics. Want to become more proficient in system design.',
        priorityGoalAgency: 'Help improve our code review process. Currently reviews take too long and we need to streamline.',
        progressReport: 'Completed 3 out of 4 sprints for Q4. On track for the release. Learning materials consumption is at 80%.',
        goodNews: 'Got appreciation from the client for quick bug resolution. Also completed AWS certification!',
        supportNeeded: 'Need access to the new monitoring tools. Also would benefit from a mentor for architecture decisions.',
        priorityDiscussions: 'Want to discuss the possibility of leading the mobile app project next quarter.',
        headsUp: 'Taking 2 days off next week for a family function.',
        anythingElse: 'Really enjoying the new flexible work policy. It has improved my productivity significantly.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: ritesh.id,
        reporterId: hitenReporter.id,
        meetingDate: daysAgo(1),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Things are going well at home. Started a new fitness routine.',
        checkInProfessional: 'Making good progress on the mobile app. Facing some challenges with state management.',
        priorityGoalProfessional: 'Continue improving React Native skills.',
        priorityGoalAgency: 'Document the mobile architecture for knowledge sharing.',
        progressReport: 'Sprint 1 of mobile app 70% complete. Some blockers with third-party SDK integration.',
        goodNews: 'Found a great solution for the offline sync issue we discussed.',
        supportNeeded: 'Need help with iOS-specific issues. Maybe pair programming with someone experienced.',
        priorityDiscussions: 'Timeline for the beta launch.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: sneha.id,
        reporterId: hitenReporter.id,
        meetingDate: daysAgo(7),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Recently moved to a new apartment. Still settling in.',
        checkInProfessional: 'Backend optimization project is going well. Reduced API response times by 40%.',
        priorityGoalProfessional: 'Learn Kubernetes and container orchestration.',
        priorityGoalAgency: 'Improve our CI/CD pipeline efficiency.',
        progressReport: 'Database optimization complete. Now working on caching layer.',
        goodNews: 'Performance improvements were highlighted in the client meeting!',
        supportNeeded: 'Would like to attend the upcoming DevOps conference.',
        anythingElse: 'Interested in mentoring junior developers.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: vikram.id,
        reporterId: hitenReporter.id,
        meetingDate: daysAgo(3),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Celebrated my birthday last week. Feeling good.',
        checkInProfessional: 'Security audit findings have been addressed. No critical issues remaining.',
        priorityGoalProfessional: 'Get CISSP certification.',
        priorityGoalAgency: 'Establish security best practices documentation.',
        progressReport: 'All high-priority security fixes deployed. Working on medium-priority items.',
        goodNews: 'Passed the internal security audit with flying colors.',
        supportNeeded: 'Budget approval for security tools subscription.',
        headsUp: 'We need to schedule the quarterly security review.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: amit.id,
        reporterId: priyaReporter.id,
        meetingDate: daysAgo(5),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Everything is going smoothly. Enjoying the winter weather.',
        checkInProfessional: 'The new design system is almost ready for handoff.',
        priorityGoalProfessional: 'Learn 3D design and motion graphics.',
        priorityGoalAgency: 'Create reusable component library for faster design iterations.',
        progressReport: 'Design system 90% complete. Documentation in progress.',
        goodNews: 'The client loved the new landing page design!',
        supportNeeded: 'Need Figma Organization license for better collaboration.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: pooja.id,
        reporterId: rajReporter.id,
        meetingDate: daysAgo(2),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Planning a vacation next month. Excited about it!',
        checkInProfessional: 'Q4 campaign exceeded targets by 25%.',
        priorityGoalProfessional: 'Master data analytics and attribution modeling.',
        priorityGoalAgency: 'Improve our content calendar process.',
        progressReport: 'Social media engagement up 40%. Working on influencer partnerships.',
        goodNews: 'Our blog post went viral - 50K views!',
        supportNeeded: 'Need approval for the new marketing automation tool.',
        priorityDiscussions: 'Q1 marketing budget allocation.',
      },
    }),
    
    // Scheduled meetings (upcoming)
    prisma.meeting.create({
      data: {
        employeeId: ritesh.id,
        reporterId: hitenReporter.id,
        meetingDate: daysFromNow(7),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: sneha.id,
        reporterId: hitenReporter.id,
        meetingDate: daysFromNow(5),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: vikram.id,
        reporterId: hitenReporter.id,
        meetingDate: daysFromNow(3),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: amit.id,
        reporterId: priyaReporter.id,
        meetingDate: daysFromNow(4),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: sanjay.id,
        reporterId: anitaReporter.id,
        meetingDate: daysFromNow(2),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    
    // Reporter's meeting with Super Admin
    prisma.meeting.create({
      data: {
        employeeId: hitenReporter.id,
        reporterId: superAdmin.id,
        meetingDate: daysAgo(10),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Family is doing well. Kids started school.',
        checkInProfessional: 'Team is performing excellently. We shipped 3 major features this month.',
        priorityGoalProfessional: 'Improve leadership and delegation skills.',
        priorityGoalAgency: 'Reduce technical debt by 30% this quarter.',
        progressReport: 'All team members are on track. Two promotions recommended.',
        goodNews: 'Won the internal hackathon!',
        supportNeeded: 'Need budget for team building activities.',
        priorityDiscussions: 'Hiring plan for Q1.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: hitenReporter.id,
        reporterId: superAdmin.id,
        meetingDate: daysFromNow(6),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    
    // Test Reporter's meetings with their team
    prisma.meeting.create({
      data: {
        employeeId: alex.id,
        reporterId: testReporter.id,
        meetingDate: daysAgo(7),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Just got back from a short vacation. Feeling refreshed!',
        checkInProfessional: 'Making good progress on the API refactoring project.',
        priorityGoalProfessional: 'Learn GraphQL and improve API design skills.',
        priorityGoalAgency: 'Help standardize our API documentation.',
        progressReport: 'Completed 80% of the API refactoring. On track for deadline.',
        goodNews: 'Got positive feedback from the QA team on code quality.',
        supportNeeded: 'Would like to attend a GraphQL workshop.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: alex.id,
        reporterId: testReporter.id,
        meetingDate: daysFromNow(7),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: sarah.id,
        reporterId: testReporter.id,
        meetingDate: daysAgo(5),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Things are going well. Started a new hobby - painting.',
        checkInProfessional: 'Leading the frontend migration to React 18.',
        priorityGoalProfessional: 'Master Next.js and server components.',
        priorityGoalAgency: 'Improve our frontend testing coverage.',
        progressReport: 'Migration 60% complete. Facing some challenges with legacy code.',
        goodNews: 'Our new component library is getting great adoption!',
        supportNeeded: 'Need help with some complex state management issues.',
        priorityDiscussions: 'Timeline for the migration completion.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: sarah.id,
        reporterId: testReporter.id,
        meetingDate: daysFromNow(5),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: mike.id,
        reporterId: testReporter.id,
        meetingDate: daysAgo(3),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Family is visiting next week, excited about that!',
        checkInProfessional: 'DevOps pipeline improvements going smoothly.',
        priorityGoalProfessional: 'Get AWS Solutions Architect certification.',
        priorityGoalAgency: 'Reduce deployment time by 50%.',
        progressReport: 'Already reduced deployment time by 30%. Working on further optimizations.',
        goodNews: 'Zero downtime deployments are now working perfectly!',
        supportNeeded: 'Budget for AWS certification exam.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: mike.id,
        reporterId: testReporter.id,
        meetingDate: daysFromNow(3),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: emily.id,
        reporterId: testReporter.id,
        meetingDate: daysAgo(2),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Recently adopted a puppy, adjusting to the new schedule.',
        checkInProfessional: 'Working on the mobile app performance optimization.',
        priorityGoalProfessional: 'Learn Flutter for cross-platform development.',
        priorityGoalAgency: 'Improve app load time across all platforms.',
        progressReport: 'App startup time reduced by 40%. Users are noticing the improvement.',
        goodNews: 'App store rating improved to 4.7 stars!',
        supportNeeded: 'Would like a mentor for mobile architecture decisions.',
        headsUp: 'Taking a day off next Friday for a vet appointment.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: emily.id,
        reporterId: testReporter.id,
        meetingDate: daysFromNow(4),
        status: MeetingStatus.SCHEDULED,
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: james.id,
        reporterId: testReporter.id,
        meetingDate: daysAgo(1),
        status: MeetingStatus.COMPLETED,
        checkInPersonal: 'Everything is good. Enjoying the new work-from-home setup.',
        checkInProfessional: 'Database optimization project is progressing well.',
        priorityGoalProfessional: 'Master PostgreSQL advanced features.',
        priorityGoalAgency: 'Implement database monitoring and alerting.',
        progressReport: 'Query performance improved by 60%. Documentation in progress.',
        goodNews: 'Our database now handles 3x more concurrent users!',
        supportNeeded: 'Need access to production database monitoring tools.',
        anythingElse: 'Interested in presenting at the next tech talk.',
      },
    }),
    prisma.meeting.create({
      data: {
        employeeId: james.id,
        reporterId: testReporter.id,
        meetingDate: daysFromNow(6),
        status: MeetingStatus.SCHEDULED,
      },
    }),
  ])
  console.log(`   ✅ Created ${meetings.length} meetings`)

  // Create Todos
  console.log('✅ Creating todos...')
  const completedMeetings = meetings.filter(m => m.status === MeetingStatus.COMPLETED)
  
  const todos = await Promise.all([
    // Todos from meetings
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[0]?.id,
        title: 'Complete AWS architecture documentation',
        description: 'Document the new microservices architecture for the team wiki',
        assignedToId: ritesh.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(7),
        priority: TodoPriority.HIGH,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[0]?.id,
        title: 'Set up monitoring dashboard access',
        description: 'Configure Grafana access for Ritesh',
        assignedToId: hitenReporter.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(3),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[1]?.id,
        title: 'Fix iOS push notification bug',
        description: 'Debug and fix the push notification issue on iOS 16+',
        assignedToId: ritesh.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(5),
        priority: TodoPriority.HIGH,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[2]?.id,
        title: 'Implement Redis caching layer',
        description: 'Add Redis caching for frequently accessed API endpoints',
        assignedToId: sneha.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(10),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[3]?.id,
        title: 'Update security documentation',
        description: 'Document new security protocols and procedures',
        assignedToId: vikram.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(14),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[4]?.id,
        title: 'Create Figma component library',
        description: 'Build reusable components in Figma for the design system',
        assignedToId: amit.id,
        createdById: priyaReporter.id,
        dueDate: daysFromNow(21),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        meetingId: completedMeetings[5]?.id,
        title: 'Prepare Q1 marketing proposal',
        description: 'Create detailed proposal for Q1 marketing initiatives',
        assignedToId: pooja.id,
        createdById: rajReporter.id,
        dueDate: daysFromNow(12),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    
    // Completed todos
    prisma.todo.create({
      data: {
        title: 'Code review - Payment module',
        description: 'Review PR #234 for payment module changes',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysAgo(2),
        priority: TodoPriority.HIGH,
        status: TodoStatus.DONE,
        completedAt: daysAgo(1),
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Team retrospective preparation',
        description: 'Prepare slides and agenda for quarterly retrospective',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysAgo(5),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.DONE,
        completedAt: daysAgo(4),
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Update project roadmap',
        description: 'Reflect Q4 changes in the project roadmap',
        assignedToId: ritesh.id,
        createdById: hitenReporter.id,
        dueDate: daysAgo(3),
        priority: TodoPriority.LOW,
        status: TodoStatus.DONE,
        completedAt: daysAgo(2),
      },
    }),
    
    // Standalone todos (not linked to meetings)
    prisma.todo.create({
      data: {
        title: 'Organize team lunch',
        description: 'Plan and organize monthly team lunch event',
        assignedToId: priyaReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(8),
        priority: TodoPriority.LOW,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Interview candidates for senior developer position',
        description: 'Conduct technical interviews for 3 shortlisted candidates',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(4),
        priority: TodoPriority.HIGH,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    
    // More todos for Reporter (Hiten)
    prisma.todo.create({
      data: {
        title: 'Review Q4 performance reports',
        description: 'Go through individual performance reports and prepare feedback',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(2),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Prepare sprint planning deck',
        description: 'Create presentation for next sprint planning meeting',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(1),
        priority: TodoPriority.HIGH,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Update team documentation',
        description: 'Review and update the engineering team wiki pages',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(10),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Schedule 1:1s for new joiners',
        description: 'Set up introductory meetings with recent team additions',
        assignedToId: hitenReporter.id,
        createdById: hitenReporter.id,
        dueDate: daysFromNow(3),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Finalize training budget',
        description: 'Submit training budget proposal for team certifications',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(5),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Code review backlog',
        description: 'Clear pending code reviews from the team',
        assignedToId: hitenReporter.id,
        createdById: hitenReporter.id,
        dueDate: daysAgo(1),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Update project milestones',
        description: 'Sync Jira milestones with actual project timeline',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(7),
        priority: TodoPriority.LOW,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Team building activity planning',
        description: 'Coordinate with HR for quarterly team event',
        assignedToId: hitenReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(14),
        priority: TodoPriority.LOW,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    
    // Todos for Test Reporter
    prisma.todo.create({
      data: {
        title: 'Review team OKRs',
        description: 'Review and finalize Q1 objectives and key results for the team',
        assignedToId: testReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(2),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Conduct weekly team standup',
        description: 'Prepare agenda and lead the weekly team sync meeting',
        assignedToId: testReporter.id,
        createdById: testReporter.id,
        dueDate: daysFromNow(1),
        priority: TodoPriority.HIGH,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Complete performance evaluations',
        description: 'Fill out mid-year performance reviews for all direct reports',
        assignedToId: testReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(5),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Update project roadmap',
        description: 'Revise Q1 project roadmap based on stakeholder feedback',
        assignedToId: testReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(7),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Schedule 1:1 meetings',
        description: 'Book bi-weekly one-on-ones with all team members',
        assignedToId: testReporter.id,
        createdById: testReporter.id,
        dueDate: daysFromNow(3),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.IN_PROGRESS,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Review code PRs',
        description: 'Clear the backlog of pending pull requests',
        assignedToId: testReporter.id,
        createdById: testReporter.id,
        dueDate: daysAgo(1),
        priority: TodoPriority.HIGH,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Prepare monthly report',
        description: 'Create monthly progress report for leadership',
        assignedToId: testReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(10),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Organize knowledge sharing session',
        description: 'Plan and schedule tech talk for the engineering team',
        assignedToId: testReporter.id,
        createdById: testReporter.id,
        dueDate: daysFromNow(14),
        priority: TodoPriority.LOW,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Review hiring pipeline',
        description: 'Go through candidate applications and shortlist for interviews',
        assignedToId: testReporter.id,
        createdById: superAdmin.id,
        dueDate: daysFromNow(4),
        priority: TodoPriority.MEDIUM,
        status: TodoStatus.NOT_STARTED,
      },
    }),
    prisma.todo.create({
      data: {
        title: 'Update team wiki',
        description: 'Document new processes and best practices',
        assignedToId: testReporter.id,
        createdById: testReporter.id,
        dueDate: daysFromNow(12),
        priority: TodoPriority.LOW,
        status: TodoStatus.NOT_STARTED,
      },
    }),
  ])
  console.log(`   ✅ Created ${todos.length} todos`)

  // Create sample meeting recordings (for testing transcript viewer)
  console.log('🎙️ Creating sample recordings...')
  const recordingsData = [
    {
      meetingId: completedMeetings[0]?.id,
      language: 'en',
      summary: 'Productive discussion about the payment gateway integration and upcoming mobile app project. Ritesh shared progress on AWS certification and discussed challenges with state management.',
      keyPoints: [
        'Payment gateway integration successfully completed',
        'AWS certification achieved',
        'Mobile app project discussed for next quarter',
        'Need access to new monitoring tools',
        'Code review process needs improvement'
      ],
      sentiment: {
        score: 0.7,
        label: 'positive',
        employeeMood: 'Enthusiastic and motivated',
        reporterEngagement: 'Supportive and encouraging',
        overallTone: 'Collaborative and forward-looking'
      },
      qualityScore: 85,
      qualityDetails: {
        clarity: 9,
        actionability: 8,
        engagement: 9,
        goalAlignment: 8,
        followUp: 8,
        overallFeedback: 'Excellent meeting with clear action items and good discussion flow.'
      }
    },
    {
      meetingId: completedMeetings[2]?.id,
      language: 'hi',
      summary: 'Sneha discussed backend optimization progress and interest in DevOps. The conversation covered database improvements and mentoring opportunities.',
      keyPoints: [
        'API response times reduced by 40%',
        'Database optimization complete',
        'Interest in Kubernetes and DevOps',
        'Want to attend DevOps conference',
        'Interested in mentoring junior developers'
      ],
      sentiment: {
        score: 0.6,
        label: 'positive',
        employeeMood: 'Confident and growth-oriented',
        reporterEngagement: 'Attentive and supportive',
        overallTone: 'Professional and developmental'
      },
      qualityScore: 78,
      qualityDetails: {
        clarity: 8,
        actionability: 7,
        engagement: 8,
        goalAlignment: 8,
        followUp: 7,
        overallFeedback: 'Good meeting with clear progress updates. Could benefit from more specific action items.'
      }
    },
    {
      meetingId: completedMeetings[5]?.id,
      language: 'gu',
      summary: 'Marketing team review showing strong Q4 performance. Pooja presented campaign results and proposed new marketing automation tools.',
      keyPoints: [
        'Q4 campaign exceeded targets by 25%',
        'Social media engagement up 40%',
        'Blog post went viral with 50K views',
        'Need approval for marketing automation tool',
        'Q1 budget allocation discussion needed'
      ],
      sentiment: {
        score: 0.85,
        label: 'positive',
        employeeMood: 'Excited and accomplished',
        reporterEngagement: 'Impressed and encouraging',
        overallTone: 'Celebratory and strategic'
      },
      qualityScore: 92,
      qualityDetails: {
        clarity: 9,
        actionability: 9,
        engagement: 10,
        goalAlignment: 9,
        followUp: 9,
        overallFeedback: 'Excellent meeting showcasing strong results and clear plans for the future.'
      }
    }
  ]

  for (const rec of recordingsData) {
    if (rec.meetingId) {
      await prisma.meetingRecording.create({
        data: {
          meetingId: rec.meetingId,
          transcript: `[Sample transcript in ${rec.language}]\n\nThis is a sample transcript for testing purposes. The actual transcript would contain the full conversation from the one-on-one meeting.\n\nTopics discussed:\n${rec.keyPoints?.join('\n- ')}\n\n[End of transcript]`,
          language: rec.language,
          summary: rec.summary,
          keyPoints: rec.keyPoints,
          autoTodos: [
            { title: 'Follow up on discussed items', description: 'Review and act on meeting points', assignTo: 'employee', priority: 'MEDIUM' },
            { title: 'Schedule next review', description: 'Set up follow-up meeting', assignTo: 'reporter', priority: 'LOW' }
          ],
          sentiment: rec.sentiment,
          qualityScore: rec.qualityScore,
          qualityDetails: rec.qualityDetails,
          status: RecordingStatus.COMPLETED,
          duration: Math.floor(Math.random() * 600) + 300, // 5-15 minutes
          recordedAt: new Date(),
          processedAt: new Date(),
        },
      })
    }
  }
  console.log(`   ✅ Created ${recordingsData.length} sample recordings`)

  // Create system settings (optional, for testing settings page)
  console.log('⚙️ Creating system settings...')
  await prisma.systemSettings.create({
    data: {
      id: 'system',
      openaiModel: 'gpt-4o',
      whisperModel: 'whisper-1',
      maxRecordingMins: 25,
    },
  })
  console.log('   ✅ System settings created')

  // Summary
  console.log('\n🎉 Database seeding completed!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Summary:')
  console.log(`   • ${departments.length} departments`)
  console.log(`   • 1 super admin`)
  console.log(`   • ${reporters.length} reporters`)
  console.log(`   • ${employees.length} employees`)
  console.log(`   • ${meetings.length} meetings`)
  console.log(`   • ${todos.length} todos`)
  console.log(`   • ${recordingsData.length} recordings`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n🔐 Test Login Accounts:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Super Admin:    nishant@test.com')
  console.log('   Reporter:       hiten@test.com')
  console.log('   Test Reporter:  test-reporter@test.com')
  console.log('   Employee:       ritesh@test.com')
  console.log('   New User:       new-user@test.com (will trigger onboarding)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
