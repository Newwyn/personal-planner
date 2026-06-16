// app.js

// --- Helper for ISO Week Detection ---
function getYearWeekString(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}

// --- State Management ---
let state = {
    activeView: 'home', // 'home', 'calendar', 'work-planner'
    currentDate: new Date(),
    currentView: 'month', // 'month', 'week', 'day'
    events: [],
    tasks: [],
    habits: [],
    scratchpad: '',
    selectedWorkPlannerDay: 'monday', // Current selected day in weekly planner
    editingWeeklyTaskId: null, // Track task ID being edited inline
    weeklyWorkFilter: 'all', // Filter for weekly work tasks: 'all', 'active', 'completed'
    lastOpenedWeek: '', // Tracks the ISO week of last login (for auto-reset)
    weeklyWorkAddMode: 'ai', // Add mode: 'ai' or 'manual'
    isScheduleToolsExpanded: false, // Tracks if copy tools section is expanded
    weeklyWorkTasks: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    },
    userSession: null, // Holds { username, password } if logged in
    lastUpdated: 0, // Timestamp for sync comparisons
    pomodoro: {
        timeLeft: 1500, // 25 minutes
        durationWork: 1500,
        durationBreak: 300,
        isRunning: false,
        mode: 'work', // 'work', 'break'
        intervalId: null
    }
};

// --- Initializing App ---
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed to Register', err));
    }

    loadStateFromLocalStorage();
    
    // Set default selected day in planner to today
    if (!state.selectedWorkPlannerDay) {
        state.selectedWorkPlannerDay = getTodayDayName();
    }
    
    initEventListeners();
    checkHabitsStreakValidity();
    
    // Periodically tick countdown timers in Weekly Planner every 30 seconds
    setInterval(() => {
        if (state.activeView === 'work-planner') {
            renderWeeklyWorkPlanner();
        }
    }, 30000);

    // Live digital clock ticker for today's header in Weekly Work Planner
    setInterval(() => {
        const clockEl = document.getElementById('planner-current-clock');
        if (clockEl) {
            const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
            clockEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${timeStr}`;
        }
    }, 1000);

    // Initial view rendering
    switchView(state.activeView);
    
    // Check user authentication and start database sync
    checkUserSessionOnStart();
});

// --- Local Storage Sync ---
function saveStateToLocalStorage() {
    state.lastUpdated = Date.now();
    const dataToSave = {
        activeView: state.activeView,
        events: state.events,
        tasks: state.tasks,
        habits: state.habits,
        scratchpad: state.scratchpad,
        selectedWorkPlannerDay: state.selectedWorkPlannerDay,
        weeklyWorkFilter: state.weeklyWorkFilter,
        lastOpenedWeek: state.lastOpenedWeek,
        weeklyWorkAddMode: state.weeklyWorkAddMode,
        isScheduleToolsExpanded: state.isScheduleToolsExpanded,
        weeklyWorkTasks: state.weeklyWorkTasks,
        lastUpdated: state.lastUpdated
    };
    localStorage.setItem('aura_planner_state', JSON.stringify(dataToSave));
    
    // Asynchronously push updates to Vercel KV cloud
    if (state.userSession) {
        syncWithCloud();
    }
}

function loadStateFromLocalStorage() {
    const data = localStorage.getItem('aura_planner_state');
    const currentWeekStr = getYearWeekString(new Date());

    if (data) {
        try {
            const parsed = JSON.parse(data);
            state.activeView = parsed.activeView || 'home';
            state.events = parsed.events || [];
            state.tasks = parsed.tasks || [];
            state.habits = parsed.habits || [];
            state.scratchpad = parsed.scratchpad || '';
            state.selectedWorkPlannerDay = parsed.selectedWorkPlannerDay || getTodayDayName();
            state.weeklyWorkFilter = parsed.weeklyWorkFilter || 'all';
            state.lastOpenedWeek = parsed.lastOpenedWeek || currentWeekStr;
            state.weeklyWorkAddMode = parsed.weeklyWorkAddMode || 'ai';
            state.isScheduleToolsExpanded = parsed.isScheduleToolsExpanded || false;
            state.weeklyWorkTasks = parsed.weeklyWorkTasks || {
                monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
            };
            state.lastUpdated = parsed.lastUpdated || 0;

            // Check if week transitioned since last opened
            if (parsed.lastOpenedWeek && parsed.lastOpenedWeek !== currentWeekStr) {
                // Reset completed status of all tasks without deleting them
                for (let day in state.weeklyWorkTasks) {
                    state.weeklyWorkTasks[day].forEach(task => {
                        task.isDone = false;
                    });
                }
                state.lastOpenedWeek = currentWeekStr;
                saveStateToLocalStorage();
                // Delay alert slightly to let DOM initialize
                setTimeout(() => {
                    alert("Tuần mới đã bắt đầu! Trạng thái công việc tuần cũ của bạn đã được thiết lập lại (reset) thành chưa hoàn thành.");
                }, 500);
            }
            
            // Populate scratchpad textarea
            document.getElementById('scratchpad').value = state.scratchpad;
        } catch (e) {
            console.error("Failed to load local storage state:", e);
        }
    } else {
        // Load default habits for a premium initial experience
        state.habits = [
            { id: 'h1', name: 'Morning Meditation 🧘', streak: 3, completedToday: true, lastCompletedDate: getTodayString() },
            { id: 'h2', name: 'Read 10 Pages 📚', streak: 5, completedToday: false, lastCompletedDate: getYesterdayString() },
            { id: 'h3', name: 'Coding Practice 💻', streak: 12, completedToday: false, lastCompletedDate: getYesterdayString() }
        ];
        // Default tasks
        state.tasks = [
            { id: 't1', text: 'Explore Aura Planner features', completed: false },
            { id: 't2', text: 'Set up my goals for this week', completed: false },
            { id: 't3', text: 'Do a 25-minute study block', completed: true }
        ];
        // Default Weekly Work tasks (matches user requested format)
        state.weeklyWorkTasks = {
            monday: [
                { id: 1686900000001, title: "Weekly kickoff meeting 👥", isDone: true, time: "08:00", note: "Xác định mục tiêu chính", priority: "high" },
                { id: 1686900000002, title: "Học tiếng Anh 30 phút 📚", isDone: false, time: "20:00", note: "Học từ vựng mới", priority: "medium" }
            ],
            tuesday: [
                { id: 1686900000003, title: "Deep work focus block 💻", isDone: false, time: "09:30", note: "Hoàn thiện thiết kế giao diện", priority: "high" }
            ],
            wednesday: [
                { id: 1686900000004, title: "Tập gym / Chạy bộ 🏃", isDone: false, time: "18:00", note: "Chạy tối thiểu 3km", priority: "low" }
            ],
            thursday: [
                { id: 1686900000005, title: "Mid-week review & sync ☕", isDone: false, time: "10:00", note: "Báo cáo tiến độ nhóm", priority: "medium" }
            ],
            friday: [
                { id: 1686900000006, title: "Dọn dẹp bàn làm việc 🧼", isDone: false, time: "17:00", note: "Lau màn hình, xếp lại tài liệu", priority: "low" }
            ],
            saturday: [
                { id: 1686900000007, title: "Xem phim giải trí 🎬", isDone: false, time: "21:00", note: "Relax cuối tuần", priority: "low" }
            ],
            sunday: [
                { id: 1686900000008, title: "Reflect & set weekly goals 🎯", isDone: false, time: "20:00", note: "Chuẩn bị cho tuần tiếp theo", priority: "medium" }
            ]
        };
        state.selectedWorkPlannerDay = getTodayDayName();
        saveStateToLocalStorage();
    }
}

// --- Date & Time Utilities ---
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodayDayName() {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[new Date().getDay()];
}

// --- Habit Streak Logic ---
function checkHabitsStreakValidity() {
    const today = getTodayString();
    const yesterday = getYesterdayString();
    let updated = false;

    state.habits.forEach(habit => {
        if (habit.lastCompletedDate && habit.lastCompletedDate !== today && habit.lastCompletedDate !== yesterday) {
            habit.streak = 0;
            habit.completedToday = false;
            updated = true;
        }
        if (habit.lastCompletedDate === yesterday && habit.completedToday) {
            habit.completedToday = false;
            updated = true;
        }
    });

    if (updated) saveStateToLocalStorage();
}

// --- View Router ---
function switchView(viewName) {
    state.activeView = viewName;
    saveStateToLocalStorage();

    const homeView = document.getElementById('home-view');
    const calendarView = document.getElementById('calendar-view');
    const workPlannerView = document.getElementById('work-planner-view');

    homeView.classList.add('hidden');
    calendarView.classList.add('hidden');
    workPlannerView.classList.add('hidden');

    if (viewName === 'home') {
        homeView.classList.remove('hidden');
    } else if (viewName === 'calendar') {
        calendarView.classList.remove('hidden');
        renderApp();
    } else if (viewName === 'work-planner') {
        workPlannerView.classList.remove('hidden');
        renderWeeklyWorkPlanner();
    }
}

// --- Event Listeners Initialization ---
function initEventListeners() {
    // Navigation cards
    document.getElementById('nav-calendar-card').addEventListener('click', () => switchView('calendar'));
    document.getElementById('nav-work-card').addEventListener('click', () => switchView('work-planner'));
    
    // Home button clicks
    document.getElementById('calendar-home-btn').addEventListener('click', () => switchView('home'));
    document.getElementById('work-home-btn').addEventListener('click', () => switchView('home'));

    // Calendar Navigation
    document.getElementById('prev-period-btn').addEventListener('click', navigatePrevious);
    document.getElementById('next-period-btn').addEventListener('click', navigateNext);
    document.getElementById('today-btn').addEventListener('click', navigateToday);
    
    // View Selectors
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.currentView = e.currentTarget.dataset.view;
            renderApp();
        });
    });

    // Scratchpad auto-save
    document.getElementById('scratchpad').addEventListener('input', (e) => {
        state.scratchpad = e.target.value;
        saveStateToLocalStorage();
    });

    // Task Form
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-task-input');
        const text = input.value.trim();
        if (text) {
            state.tasks.push({
                id: 'task_' + Date.now(),
                text: text,
                completed: false
            });
            input.value = '';
            saveStateToLocalStorage();
            renderTasks();
        }
    });

    document.getElementById('clear-completed-btn').addEventListener('click', () => {
        state.tasks = state.tasks.filter(t => !t.completed);
        saveStateToLocalStorage();
        renderTasks();
    });

    // Habit Form
    document.getElementById('add-habit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-habit-input');
        const name = input.value.trim();
        if (name) {
            state.habits.push({
                id: 'habit_' + Date.now(),
                name: name,
                streak: 0,
                completedToday: false,
                lastCompletedDate: ''
            });
            input.value = '';
            saveStateToLocalStorage();
            renderHabits();
        }
    });

    // Pomodoro Timer
    document.getElementById('timer-toggle-btn').addEventListener('click', togglePomodoro);
    document.getElementById('timer-reset-btn').addEventListener('click', resetPomodoro);

    // Event Modal
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.getElementById('event-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('event-form').addEventListener('submit', saveEvent);
    document.getElementById('event-delete-btn').addEventListener('click', deleteEvent);

    // Day Events Mobile Modal
    document.getElementById('mobile-day-events-close-btn').addEventListener('click', closeDayEventsMobileModal);

    // Backup & Restore
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);

    // Auth & Logout listeners
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
    document.getElementById('logout-btn-calendar').addEventListener('click', handleLogout);
    document.getElementById('logout-btn-work').addEventListener('click', handleLogout);
}

// --- Navigation Logics ---
function navigatePrevious() {
    if (state.currentView === 'month') {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    } else if (state.currentView === 'week') {
        state.currentDate.setDate(state.currentDate.getDate() - 7);
    } else if (state.currentView === 'day') {
        state.currentDate.setDate(state.currentDate.getDate() - 1);
    }
    renderApp();
}

function navigateNext() {
    if (state.currentView === 'month') {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    } else if (state.currentView === 'week') {
        state.currentDate.setDate(state.currentDate.getDate() + 7);
    } else if (state.currentView === 'day') {
        state.currentDate.setDate(state.currentDate.getDate() + 1);
    }
    renderApp();
}

function navigateToday() {
    state.currentDate = new Date();
    renderApp();
}

// --- Calendar Render Controller ---
function renderApp() {
    renderHeaderLabel();
    renderCalendar();
    renderTasks();
    renderHabits();
}

function renderHeaderLabel() {
    const display = document.getElementById('current-period-display');
    const options = { year: 'numeric', month: 'long' };
    
    if (state.currentView === 'month') {
        display.innerText = state.currentDate.toLocaleDateString('en-US', options);
    } else if (state.currentView === 'week') {
        const startOfWeek = new Date(state.currentDate);
        const day = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - day);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const optMonth = { month: 'short' };
        if (startOfWeek.getFullYear() === endOfWeek.getFullYear()) {
            if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                display.innerText = `${startOfWeek.toLocaleDateString('en-US', optMonth)} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
            } else {
                display.innerText = `${startOfWeek.toLocaleDateString('en-US', optMonth)} ${startOfWeek.getDate()} - ${endOfWeek.toLocaleDateString('en-US', optMonth)} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
            }
        } else {
            display.innerText = `${startOfWeek.toLocaleDateString('en-US', optMonth)} ${startOfWeek.getDate()}, ${startOfWeek.getFullYear()} - ${endOfWeek.toLocaleDateString('en-US', optMonth)} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
        }
    } else if (state.currentView === 'day') {
        const optDay = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        display.innerText = state.currentDate.toLocaleDateString('en-US', optDay);
    }
}

// --- Calendar Rendering Engines ---
function renderCalendar() {
    const wrapper = document.getElementById('calendar-view-wrapper');
    wrapper.innerHTML = '';

    if (state.currentView === 'month') {
        renderMonthView(wrapper);
    } else if (state.currentView === 'week') {
        renderWeekView(wrapper);
    } else if (state.currentView === 'day') {
        renderDayView(wrapper);
    }
}

// Month View
function renderMonthView(container) {
    const headerGrid = document.createElement('div');
    headerGrid.className = 'calendar-header-grid';
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
        const d = document.createElement('div');
        d.innerText = day;
        headerGrid.appendChild(d);
    });
    container.appendChild(headerGrid);

    const bodyGrid = document.createElement('div');
    bodyGrid.className = 'calendar-body-grid';

    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    // Padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const cell = createCell(year, month - 1, prevTotalDays - i, true);
        bodyGrid.appendChild(cell);
    }
    // Days
    for (let i = 1; i <= totalDays; i++) {
        const cell = createCell(year, month, i, false);
        bodyGrid.appendChild(cell);
    }
    // Next month padding
    const totalCells = bodyGrid.children.length;
    const remaining = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        const cell = createCell(year, month + 1, i, true);
        bodyGrid.appendChild(cell);
    }

    container.appendChild(bodyGrid);
}

function createCell(year, month, dateNum, isOtherMonth) {
    const dObj = new Date(year, month, dateNum);
    const dateStr = formatDateString(dObj);

    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';
    if (isOtherMonth) cell.classList.add('other-month');

    const todayStr = formatDateString(new Date());
    if (dateStr === todayStr) {
        cell.classList.add('today');
    }

    const cellHeader = document.createElement('div');
    cellHeader.className = 'day-number-container';
    
    const numSpan = document.createElement('span');
    numSpan.className = 'day-number';
    numSpan.innerText = dateNum;
    cellHeader.appendChild(numSpan);
    cell.appendChild(cellHeader);

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'cell-events';

    const dayEvents = state.events.filter(e => e.date === dateStr);
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    dayEvents.forEach(evt => {
        const chip = document.createElement('div');
        chip.className = `event-chip event-${evt.category}`;
        chip.innerText = `${evt.startTime} ${evt.title}`;
        chip.title = `${evt.title} (${evt.startTime} - ${evt.endTime})`;
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditEventModal(evt);
        });
        eventsContainer.appendChild(chip);
    });

    cell.appendChild(eventsContainer);

    cell.addEventListener('click', () => {
        const hasEvents = state.events.some(e => e.date === dateStr);
        if (window.innerWidth <= 768 && hasEvents) {
            openDayEventsMobileModal(dateStr);
        } else {
            openCreateEventModal(dateStr);
        }
    });

    return cell;
}

// Week View
function renderWeekView(container) {
    const weekGrid = document.createElement('div');
    weekGrid.className = 'calendar-body-grid week-grid-layout';
    weekGrid.style.gridAutoRows = 'auto';
    weekGrid.style.minHeight = '350px';

    const startOfWeek = new Date(state.currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(dayDate.getDate() + i);
        const dateStr = formatDateString(dayDate);

        const col = document.createElement('div');
        col.className = 'calendar-day-cell';
        col.style.borderRight = i === 6 ? 'none' : '1px solid var(--border-glass)';
        col.style.minHeight = '350px';

        const todayStr = formatDateString(new Date());
        if (dateStr === todayStr) {
            col.classList.add('today');
        }

        const header = document.createElement('div');
        header.className = 'day-number-container';
        header.style.flexDirection = 'column';
        header.style.alignItems = 'center';
        header.style.padding = '0.5rem 0';
        header.style.borderBottom = '1px solid var(--border-glass)';
        header.style.marginBottom = '0.75rem';

        const nameSpan = document.createElement('span');
        nameSpan.style.fontSize = '0.75rem';
        nameSpan.style.color = 'var(--text-secondary)';
        nameSpan.style.textTransform = 'uppercase';
        nameSpan.innerText = weekdays[i].slice(0, 3);

        const numSpan = document.createElement('span');
        numSpan.className = 'day-number';
        numSpan.innerText = dayDate.getDate();

        header.appendChild(nameSpan);
        header.appendChild(numSpan);
        col.appendChild(header);

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'cell-events';
        eventsContainer.style.maxHeight = 'none';

        const dayEvents = state.events.filter(e => e.date === dateStr);
        dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

        dayEvents.forEach(evt => {
            const card = document.createElement('div');
            card.className = `event-chip event-${evt.category}`;
            card.style.whiteSpace = 'normal';
            card.style.padding = '0.5rem';
            card.style.borderRadius = '8px';
            card.innerHTML = `<div style="font-weight: 600; font-size: 0.8rem;">${evt.title}</div>
                              <div style="font-size: 0.7rem; opacity: 0.85; margin-top: 0.15rem;">
                                  <i class="fa-regular fa-clock"></i> ${evt.startTime} - ${evt.endTime}
                              </div>`;
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditEventModal(evt);
            });
            eventsContainer.appendChild(card);
        });

        col.appendChild(eventsContainer);
        col.addEventListener('click', () => {
            const hasEvents = state.events.some(e => e.date === dateStr);
            if (window.innerWidth <= 768 && hasEvents) {
                openDayEventsMobileModal(dateStr);
            } else {
                openCreateEventModal(dateStr);
            }
        });
        weekGrid.appendChild(col);
    }
    container.appendChild(weekGrid);
}

// Day View
function renderDayView(container) {
    const dateStr = formatDateString(state.currentDate);

    const dayViewWrapper = document.createElement('div');
    dayViewWrapper.style.padding = '1rem 2rem';
    dayViewWrapper.style.display = 'flex';
    dayViewWrapper.style.flexDirection = 'column';
    dayViewWrapper.style.gap = '1.25rem';
    dayViewWrapper.style.flexGrow = '1';
    dayViewWrapper.style.overflowY = 'auto';

    const dayEvents = state.events.filter(e => e.date === dateStr);
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const titleEl = document.createElement('h3');
    titleEl.style.fontSize = '1.1rem';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = 'var(--text-secondary)';
    titleEl.innerText = `Agenda (${dayEvents.length} events)`;
    dayViewWrapper.appendChild(titleEl);

    if (dayEvents.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.display = 'flex';
        emptyState.style.flexDirection = 'column';
        emptyState.style.alignItems = 'center';
        emptyState.style.justifyContent = 'center';
        emptyState.style.flexGrow = '1';
        emptyState.style.color = 'var(--text-muted)';
        emptyState.style.padding = '4rem 0';
        emptyState.innerHTML = `<i class="fa-solid fa-calendar-day" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;"></i>
                                <p style="font-size: 1rem; font-weight: 500;">Your agenda is clear today.</p>
                                <button class="btn btn-primary" style="margin-top: 1rem;" id="day-view-add-btn">
                                    <i class="fa-solid fa-plus"></i> Add Event
                                </button>`;
        dayViewWrapper.appendChild(emptyState);
        container.appendChild(dayViewWrapper);

        document.getElementById('day-view-add-btn').addEventListener('click', () => {
            openCreateEventModal(dateStr);
        });
        return;
    }

    const timeline = document.createElement('div');
    timeline.style.display = 'flex';
    timeline.style.flexDirection = 'column';
    timeline.style.gap = '1rem';

    dayEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'glass-panel';
        item.style.padding = '1.25rem';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.borderLeft = `5px solid var(--accent-${evt.category === 'work' ? 'blue' : evt.category === 'personal' ? 'purple' : evt.category === 'health' ? 'emerald' : 'amber'})`;
        item.style.cursor = 'pointer';
        item.style.background = 'rgba(255, 255, 255, 0.01)';

        const left = document.createElement('div');
        left.innerHTML = `<h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">${evt.title}</h4>
                          <span style="font-size: 0.85rem; color: var(--text-secondary);">
                              <i class="fa-regular fa-clock" style="margin-right: 0.35rem;"></i> ${evt.startTime} - ${evt.endTime}
                          </span>`;

        const right = document.createElement('div');
        const tag = document.createElement('span');
        tag.style.fontSize = '0.75rem';
        tag.style.padding = '0.35rem 0.75rem';
        tag.style.borderRadius = '20px';
        tag.style.fontWeight = '600';
        tag.style.textTransform = 'uppercase';
        tag.style.letterSpacing = '0.5px';
        tag.style.background = `rgba(255,255,255,0.05)`;
        tag.style.color = `var(--accent-${evt.category === 'work' ? 'blue' : evt.category === 'personal' ? 'purple' : evt.category === 'health' ? 'emerald' : 'amber'})`;
        tag.innerText = evt.category;
        right.appendChild(tag);

        item.appendChild(left);
        item.appendChild(right);
        item.addEventListener('click', () => openEditEventModal(evt));
        timeline.appendChild(item);
    });

    dayViewWrapper.appendChild(timeline);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.style.alignSelf = 'flex-start';
    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add Event`;
    addBtn.addEventListener('click', () => openCreateEventModal(dateStr));
    dayViewWrapper.appendChild(addBtn);

    container.appendChild(dayViewWrapper);
}

// --- Todo Tasks Functionality ---
function renderTasks() {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';

    if (state.tasks.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">
                                    No tasks for today. Add one below!
                               </div>`;
        return;
    }

    const sortedTasks = [...state.tasks].sort((a, b) => a.completed - b.completed);

    sortedTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.completed) item.classList.add('completed');

        const left = document.createElement('div');
        left.className = 'task-left';

        const checkbox = document.createElement('div');
        checkbox.className = 'habit-checkbox';
        if (task.completed) {
            checkbox.style.background = 'var(--accent-purple)';
            checkbox.style.borderColor = 'var(--accent-purple)';
            checkbox.innerHTML = `<i class="fa-solid fa-check" style="font-size: 0.7rem; color: white;"></i>`;
        }
        checkbox.addEventListener('click', () => toggleTaskCompletion(task.id));

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.innerText = task.text;

        left.appendChild(checkbox);
        left.appendChild(textSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.innerHTML = `<i class="fa-regular fa-trash-can"></i>`;
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        item.appendChild(left);
        item.appendChild(deleteBtn);
        container.appendChild(item);
    });
}

function toggleTaskCompletion(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveStateToLocalStorage();
        renderTasks();
    }
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveStateToLocalStorage();
    renderTasks();
}

// --- Habits Tracker Functionality ---
function renderHabits() {
    const container = document.getElementById('habits-container');
    container.innerHTML = '';

    if (state.habits.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">
                                    No habits added yet.
                               </div>`;
        return;
    }

    state.habits.forEach(habit => {
        const item = document.createElement('div');
        item.className = 'habit-item';
        if (habit.completedToday) item.classList.add('completed');

        const info = document.createElement('div');
        info.className = 'habit-info';

        const name = document.createElement('span');
        name.className = 'habit-name';
        name.innerText = habit.name;

        const streak = document.createElement('span');
        streak.className = 'habit-streak';
        streak.innerHTML = `<i class="fa-solid fa-fire" style="color: var(--accent-amber);"></i> ${habit.streak} day streak`;

        info.appendChild(name);
        info.appendChild(streak);

        const checkbox = document.createElement('div');
        checkbox.className = 'habit-checkbox';
        if (habit.completedToday) {
            checkbox.innerHTML = `<i class="fa-solid fa-check" style="font-size: 0.75rem;"></i>`;
        }
        checkbox.addEventListener('click', () => toggleHabit(habit.id));

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.alignItems = 'center';
        actions.style.gap = '0.5rem';

        const delBtn = document.createElement('button');
        delBtn.style.background = 'transparent';
        delBtn.style.border = 'none';
        delBtn.style.color = 'var(--text-muted)';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '0.75rem';
        delBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        delBtn.addEventListener('click', () => deleteHabit(habit.id));

        actions.appendChild(checkbox);
        actions.appendChild(delBtn);

        item.appendChild(info);
        item.appendChild(actions);
        container.appendChild(item);
    });
}

function toggleHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;

    const today = getTodayString();
    
    if (habit.completedToday) {
        habit.completedToday = false;
        habit.streak = Math.max(0, habit.streak - 1);
        habit.lastCompletedDate = getYesterdayString();
    } else {
        habit.completedToday = true;
        habit.streak += 1;
        habit.lastCompletedDate = today;
        playTickSound(600, 0.1);
    }

    saveStateToLocalStorage();
    renderHabits();
}

// --- ================== SPLIT-SCREEN WEEKLY WORK PLANNER LOGIC ================== ---
const dayKeysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayNamesVietnamese = {
    monday: 'Thứ 2',
    tuesday: 'Thứ 3',
    wednesday: 'Thứ 4',
    thursday: 'Thứ 5',
    friday: 'Thứ 6',
    saturday: 'Thứ 7',
    sunday: 'Chủ nhật'
};

function parseTaskWithAI(inputText) {
    let title = inputText.trim();
    let time = "";
    let note = "";
    let priority = "medium";

    // 1. Parse Priority: look for low/high keywords
    const highRegex = /\b(gấp|quan trọng|khẩn cấp|high|urgent)\b/i;
    const lowRegex = /\b(thấp|rảnh|không gấp|low|relax)\b/i;
    if (highRegex.test(title)) {
        priority = "high";
        title = title.replace(highRegex, "");
    } else if (lowRegex.test(title)) {
        priority = "low";
        title = title.replace(lowRegex, "");
    }

    // 2. Parse Note: look for note/ghi chú indicators
    const noteRegex = /\b(note:|note|ghi chú:|ghi chú|gch:|-)\s+(.*)$/i;
    const noteMatch = title.match(noteRegex);
    if (noteMatch) {
        note = noteMatch[2].trim();
        title = title.substring(0, noteMatch.index).trim();
    }

    // 3. Parse Time: match various formats (e.g. 14:30, 14h30, 9h, 3pm)
    const timeFormats = [
        /\b(?:lúc\s+)?([0-1]?\d|2[0-3]):([0-5]\d)\b/i,
        /\b(?:lúc\s+)?([0-1]?\d|2[0-3])[hH]([0-5]\d)?\b/i,
        /\b(?:lúc\s+)?(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i
    ];

    for (let format of timeFormats) {
        const match = title.match(format);
        if (match) {
            if (format === timeFormats[0]) {
                const hrs = match[1].padStart(2, '0');
                const mins = match[2].padStart(2, '0');
                time = `${hrs}:${mins}`;
            } else if (format === timeFormats[1]) {
                const hrs = match[1].padStart(2, '0');
                const mins = match[2] ? match[2].padStart(2, '0') : "00";
                time = `${hrs}:${mins}`;
            } else if (format === timeFormats[2]) {
                let hrs = parseInt(match[1]);
                const mins = match[2] ? match[2].padStart(2, '0') : "00";
                const meridiem = match[3].toLowerCase();
                if (meridiem === 'pm' && hrs < 12) hrs += 12;
                if (meridiem === 'am' && hrs === 12) hrs = 0;
                time = `${String(hrs).padStart(2, '0')}:${mins}`;
            }
            title = title.replace(match[0], "").trim();
            break;
        }
    }

    // 4. Cleanup connector words
    title = title.replace(/^\s*(lúc|vào lúc|at|on|lúc:)\s+/i, "");
    title = title.replace(/\s+(lúc|vào lúc|at|on|lúc:)\s*$/i, "");
    title = title.trim();

    if (!title) {
        title = "Công việc mới";
    }

    return { title, time, note, priority };
}

function setWeeklyWorkAddMode(modeValue) {
    state.weeklyWorkAddMode = modeValue;
    saveStateToLocalStorage();
    renderWeeklyWorkPlanner();
}

function executeScheduleCloning() {
    const checkedBoxes = document.querySelectorAll('.copy-target-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert("Vui lòng chọn ít nhất một ngày nhận lịch sao chép!");
        return;
    }
    
    const currentDay = state.selectedWorkPlannerDay;
    const sourceTasks = state.weeklyWorkTasks[currentDay] || [];
    if (sourceTasks.length === 0) {
        alert(`Ngày ${dayNamesVietnamese[currentDay]} hiện đang không có công việc nào để sao chép!`);
        return;
    }
    
    const copyModeEl = document.querySelector('input[name="copy-mode"]:checked');
    const copyMode = copyModeEl ? copyModeEl.value : 'append';
    
    const targetDays = Array.from(checkedBoxes).map(cb => cb.value);
    const targetDayNames = targetDays.map(dayKey => dayNamesVietnamese[dayKey]).join(', ');
    
    if (copyMode === 'overwrite') {
        if (!confirm(`Bạn chắc chắn muốn GHI ĐÈ và xóa toàn bộ công việc hiện tại của các ngày: ${targetDayNames}?`)) {
            return;
        }
    } else {
        if (!confirm(`Bạn muốn sao chép gộp thêm lịch của ${dayNamesVietnamese[currentDay]} sang các ngày: ${targetDayNames}?`)) {
            return;
        }
    }
    
    targetDays.forEach(dayKey => {
        const clonedTasks = sourceTasks.map(task => ({
            id: Date.now() + Math.floor(Math.random() * 1000000) + Math.floor(Math.random() * 100),
            title: task.title,
            isDone: false,
            time: task.time || "",
            note: task.note || "",
            priority: task.priority || "medium"
        }));
        
        if (copyMode === 'overwrite') {
            state.weeklyWorkTasks[dayKey] = clonedTasks;
        } else {
            state.weeklyWorkTasks[dayKey] = [...(state.weeklyWorkTasks[dayKey] || []), ...clonedTasks];
        }
    });
    
    saveStateToLocalStorage();
    state.isScheduleToolsExpanded = false; // Collapse after copying
    renderWeeklyWorkPlanner();
    
    playTickSound(700, 0.2);
    alert(`Đã sao chép thành công lịch từ ${dayNamesVietnamese[currentDay]} sang: ${targetDayNames}!`);
}

function clearActiveDayTasks() {
    const currentDay = state.selectedWorkPlannerDay;
    const tasks = state.weeklyWorkTasks[currentDay] || [];
    if (tasks.length === 0) {
        alert("Ngày hôm nay không có công việc nào để xóa!");
        return;
    }
    
    if (confirm(`Bạn có chắc chắn muốn xóa toàn bộ công việc của ${dayNamesVietnamese[currentDay]}?`)) {
        state.weeklyWorkTasks[currentDay] = [];
        saveStateToLocalStorage();
        renderWeeklyWorkPlanner();
        playTickSound(400, 0.2);
    }
}

function setWeeklyWorkFilter(filterValue) {
    state.weeklyWorkFilter = filterValue;
    saveStateToLocalStorage();
    renderWeeklyWorkPlanner();
}

function renderWeeklyWorkPlanner() {
    const sidebar = document.getElementById('weekly-days-sidebar');
    const details = document.getElementById('weekly-day-details');
    
    if (!sidebar || !details) return;
    
    // Clear sidebar
    sidebar.innerHTML = '';
    
    const todayName = getTodayDayName();

    // 1. Draw 7 Left Navigation Cards
    dayKeysList.forEach(dayKey => {
        const tasks = state.weeklyWorkTasks[dayKey] || [];
        const completedTasks = tasks.filter(t => t.isDone).length;
        const pct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

        const navCard = document.createElement('div');
        navCard.className = 'day-nav-card';
        if (dayKey === state.selectedWorkPlannerDay) navCard.classList.add('active-day-card');
        if (dayKey === todayName) navCard.classList.add('is-today');

        // Card contents
        navCard.innerHTML = `
            <div class="day-card-top">
                <span class="day-name-title">${dayNamesVietnamese[dayKey]}</span>
                ${dayKey === todayName ? '<span class="day-badge-today">Today</span>' : ''}
            </div>
            <div class="day-card-progress-text">${completedTasks}/${tasks.length} tasks (${pct}%)</div>
            <div class="day-card-bar-bg">
                <div class="day-card-bar-fill" style="width: ${pct}%;"></div>
            </div>
        `;

        navCard.addEventListener('click', () => {
            state.selectedWorkPlannerDay = dayKey;
            state.editingWeeklyTaskId = null; // Clear edit mode when changing day
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();
        });

        sidebar.appendChild(navCard);
    });

    // Append a "Clear All Tasks" button at the bottom of the sidebar
    const clearSidebarBtn = document.createElement('button');
    clearSidebarBtn.className = 'btn';
    clearSidebarBtn.style.width = '100%';
    clearSidebarBtn.style.marginTop = '1rem';
    clearSidebarBtn.style.padding = '0.75rem';
    clearSidebarBtn.style.background = 'rgba(244, 63, 94, 0.08)';
    clearSidebarBtn.style.borderColor = 'rgba(244, 63, 94, 0.2)';
    clearSidebarBtn.style.color = 'var(--accent-rose)';
    clearSidebarBtn.style.borderRadius = '12px';
    clearSidebarBtn.style.fontSize = '0.85rem';
    clearSidebarBtn.style.fontWeight = '600';
    clearSidebarBtn.innerHTML = `<i class="fa-regular fa-trash-can"></i> Xóa hết lịch tuần này`;
    
    clearSidebarBtn.addEventListener('click', () => {
        if (confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ công việc của TẤT CẢ các ngày trong tuần này? Hành động này không thể hoàn tác.")) {
            for (let day in state.weeklyWorkTasks) {
                state.weeklyWorkTasks[day] = [];
            }
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();
            playTickSound(400, 0.25);
            alert("Đã xóa sạch toàn bộ công việc trong tuần!");
        }
    });
    
    sidebar.appendChild(clearSidebarBtn);

    // 2. Draw Right Details Workspace Panel
    const activeDayTasks = state.weeklyWorkTasks[state.selectedWorkPlannerDay] || [];
    const activeCompletedCount = activeDayTasks.filter(t => t.isDone).length;
    const activePct = activeDayTasks.length > 0 ? Math.round((activeCompletedCount / activeDayTasks.length) * 100) : 0;
    const isSelectedDayToday = (state.selectedWorkPlannerDay === getTodayDayName());

    const clockHtml = isSelectedDayToday ? `
        <span id="planner-current-clock" style="font-size: 1.1rem; color: var(--accent-blue); margin-left: 1rem; font-weight: 500; font-variant-numeric: tabular-nums;">
            <i class="fa-regular fa-clock"></i> ${new Date().toLocaleTimeString('vi-VN', { hour12: false })}
        </span>
    ` : '';

    details.innerHTML = `
        <div class="details-header-section">
            <h2 class="details-day-name" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <span>${dayNamesVietnamese[state.selectedWorkPlannerDay]}</span>
                ${clockHtml}
            </h2>
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-secondary);">
                <span>Hoàn thành ${activeCompletedCount}/${activeDayTasks.length} việc</span>
                <span>Tiến độ: ${activePct}%</span>
            </div>
            <div class="day-card-bar-bg" style="height: 6px; margin-top: 0.25rem;">
                <div class="day-card-bar-fill" style="width: ${activePct}%; background: var(--accent-blue);"></div>
            </div>
            
            <!-- Bộ lọc trạng thái công việc & Xóa việc ngày -->
            <div class="weekly-filter-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <div class="filter-buttons">
                    <button class="filter-btn ${state.weeklyWorkFilter === 'all' ? 'active' : ''}" onclick="setWeeklyWorkFilter('all')">Tất cả</button>
                    <button class="filter-btn ${state.weeklyWorkFilter === 'active' ? 'active' : ''}" onclick="setWeeklyWorkFilter('active')">Chưa hoàn thành</button>
                    <button class="filter-btn ${state.weeklyWorkFilter === 'completed' ? 'active' : ''}" onclick="setWeeklyWorkFilter('completed')">Đã hoàn thành</button>
                </div>
                <button type="button" class="btn" onclick="clearActiveDayTasks()" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; background: rgba(244, 63, 94, 0.05); border-color: rgba(244, 63, 94, 0.15); color: var(--accent-rose); border-radius: 8px;">
                    <i class="fa-regular fa-trash-can"></i> Xóa hết việc hôm nay
                </button>
            </div>
        </div>

        <!-- Schedule Tools (Copy/Clone) -->
        <div class="schedule-tools-section" style="background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border-glass); border-radius: 14px; padding: 0.75rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="toggle-schedule-tools">
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);"><i class="fa-solid fa-copy" style="margin-right: 0.35rem; color: var(--accent-blue);"></i> Sao chép lịch sang các ngày khác</span>
                <i class="fa-solid ${state.isScheduleToolsExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" id="tools-chevron" style="font-size: 0.8rem; color: var(--text-muted);"></i>
            </div>
            
            <div id="schedule-tools-content" class="${state.isScheduleToolsExpanded ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; margin-top: 0.25rem;">
                <div style="display: flex; gap: 1rem; align-items: flex-start; flex-direction: column;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">Chọn các ngày nhận lịch sao chép của ${dayNamesVietnamese[state.selectedWorkPlannerDay]}:</span>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        ${dayKeysList.map(dayKey => {
                            if (dayKey === state.selectedWorkPlannerDay) return '';
                            return `
                            <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); padding: 0.25rem 0.6rem; border-radius: 8px;">
                                <input type="checkbox" class="copy-target-checkbox" value="${dayKey}" style="accent-color: var(--accent-blue);"> ${dayNamesVietnamese[dayKey]}
                            </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 0.75rem;">
                    <div style="display: flex; gap: 1.5rem; align-items: center; font-size: 0.8rem;">
                        <span style="color: var(--text-secondary);">Chế độ sao chép:</span>
                        <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; color: var(--text-secondary);">
                            <input type="radio" name="copy-mode" value="append" checked style="accent-color: var(--accent-blue);"> Gộp thêm (Thêm vào cuối)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; color: var(--text-secondary);">
                            <input type="radio" name="copy-mode" value="overwrite" style="accent-color: var(--accent-rose);"> Ghi đè (Xóa lịch cũ)
                        </label>
                    </div>
                    
                    <button type="button" class="btn btn-primary" onclick="executeScheduleCloning()" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
                        <i class="fa-solid fa-copy"></i> Thực hiện sao chép
                    </button>
                </div>
            </div>
        </div>

        <!-- Add Task Form -->
        <form class="detail-add-form" id="detail-task-form">
            <!-- Header/Toggle mode section -->
            <div style="display: flex; width: 100%; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                    ${state.weeklyWorkAddMode === 'ai' ? '✨ Trợ lý AI tạo nhanh' : '✍️ Nhập thủ công'}
                </span>
                <button type="button" class="btn" id="toggle-add-mode-btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
                    ${state.weeklyWorkAddMode === 'ai' ? '<i class="fa-solid fa-list-check"></i> Chuyển sang Nhập thủ công' : '<i class="fa-solid fa-wand-magic-sparkles"></i> Chuyển sang AI Tạo nhanh'}
                </button>
            </div>

            <!-- Mode-based Inputs -->
            ${state.weeklyWorkAddMode === 'ai' ? `
                <!-- AI Mode: Single NLP line -->
                <div style="display: flex; width: 100%; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                    <div style="position: relative; flex-grow: 1; min-width: 280px; display: flex; align-items: center;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="position: absolute; left: 1rem; color: var(--accent-blue); font-size: 0.9rem; animation: pulse-dot 1.5s infinite;"></i>
                        <input type="text" id="ai-task-input" class="form-input" placeholder="Ví dụ: Họp nhóm lúc 14h30 note chuẩn bị slide gấp..." style="padding-left: 2.5rem; width: 100%;" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="height: 38px;">
                        <i class="fa-solid fa-plus"></i> Tạo Task
                    </button>
                </div>
            ` : `
                <!-- Manual Mode: Title, Time, Note -->
                <div style="display: flex; width: 100%; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
                    <div class="detail-form-group" style="flex: 2; min-width: 200px;">
                        <label>Tên công việc</label>
                        <input type="text" id="work-task-title" class="form-input" placeholder="ví dụ: Học tiếng Anh..." required>
                    </div>
                    <div class="detail-form-group" style="flex: 0.8; min-width: 100px;">
                        <label>Giờ làm</label>
                        <input type="time" id="work-task-time" class="form-input">
                    </div>
                    <div class="detail-form-group" style="flex: 1.5; min-width: 150px;">
                        <label>Ghi chú (Note)</label>
                        <input type="text" id="work-task-note" class="form-input" placeholder="Thêm mô tả...">
                    </div>
                    <button type="submit" class="btn btn-primary" style="height: 38px;">
                        <i class="fa-solid fa-plus"></i> Thêm
                    </button>
                </div>
            `}
        </form>

        <!-- Tasks list -->
        <div class="detail-tasks-list" id="detail-tasks-list">
            <!-- Loaded list items -->
        </div>
    `;

    // Toggle schedule tools listener
    const toggleToolsBtn = document.getElementById('toggle-schedule-tools');
    const toolsContent = document.getElementById('schedule-tools-content');
    const toolsChevron = document.getElementById('tools-chevron');
    if (toggleToolsBtn && toolsContent && toolsChevron) {
        toggleToolsBtn.addEventListener('click', () => {
            state.isScheduleToolsExpanded = !state.isScheduleToolsExpanded;
            if (state.isScheduleToolsExpanded) {
                toolsContent.classList.remove('hidden');
                toolsChevron.className = "fa-solid fa-chevron-up";
            } else {
                toolsContent.classList.add('hidden');
                toolsChevron.className = "fa-solid fa-chevron-down";
            }
            saveStateToLocalStorage();
        });
    }

    // Toggle mode listener
    const toggleModeBtn = document.getElementById('toggle-add-mode-btn');
    if (toggleModeBtn) {
        toggleModeBtn.addEventListener('click', () => {
            state.weeklyWorkAddMode = state.weeklyWorkAddMode === 'ai' ? 'manual' : 'ai';
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();
        });
    }

    // Add Form Submit Listener
    document.getElementById('detail-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        let title = "";
        let time = "";
        let note = "";
        let priority = "medium";

        if (state.weeklyWorkAddMode === 'ai') {
            const aiInput = document.getElementById('ai-task-input');
            const text = aiInput.value.trim();
            if (!text) return;

            const parsed = parseTaskWithAI(text);
            title = parsed.title;
            time = parsed.time;
            note = parsed.note;
            priority = parsed.priority;
        } else {
            const titleInput = document.getElementById('work-task-title');
            const timeInput = document.getElementById('work-task-time');
            const noteInput = document.getElementById('work-task-note');

            title = titleInput.value.trim();
            time = timeInput ? timeInput.value : '';
            note = noteInput ? noteInput.value.trim() : '';
            priority = 'medium'; // Default to medium for simplified manual task
        }

        if (title) {
            state.weeklyWorkTasks[state.selectedWorkPlannerDay].push({
                id: Date.now(),
                title: title,
                isDone: false,
                time: time || "",
                note: note || "",
                priority: priority
            });
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();

            // Refocus input field after redraw
            if (state.weeklyWorkAddMode === 'ai') {
                const newAiInput = document.getElementById('ai-task-input');
                if (newAiInput) newAiInput.focus();
            } else {
                const newTitleInput = document.getElementById('work-task-title');
                if (newTitleInput) newTitleInput.focus();
            }
        }
    });

    // Draw Task items list
    const listContainer = document.getElementById('detail-tasks-list');
    
    // Lọc công việc
    let filteredTasks = activeDayTasks;
    if (state.weeklyWorkFilter === 'active') {
        filteredTasks = activeDayTasks.filter(t => !t.isDone);
    } else if (state.weeklyWorkFilter === 'completed') {
        filteredTasks = activeDayTasks.filter(t => t.isDone);
    }

    if (filteredTasks.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 3rem 0; font-size: 0.95rem;">
                <i class="fa-solid fa-list-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.35;"></i>
                <p>Không có công việc nào phù hợp với bộ lọc.</p>
            </div>
        `;
        return;
    }

    // Check if selected day is today for countdowns
    let closestUpcomingTask = null;
    let minDiffMs = Infinity;
    const now = new Date();

    if (isSelectedDayToday) {
        activeDayTasks.forEach(task => {
            if (task.time && !task.isDone) {
                const timeParts = task.time.split(':');
                const taskTime = new Date();
                taskTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
                const diff = taskTime - now;
                if (diff > 0 && diff < minDiffMs) {
                    minDiffMs = diff;
                    closestUpcomingTask = task;
                }
            }
        });
    }

    // Sort: uncompleted first
    const sortedTasks = [...filteredTasks].sort((a, b) => a.isDone - b.isDone);

    sortedTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `detail-task-item ${task.isDone ? 'completed' : ''}`;
        
        // Highlight closest upcoming task today
        if (isSelectedDayToday && task === closestUpcomingTask) {
            item.classList.add('closest-upcoming');
        }

        // Inline edit check
        if (task.id === state.editingWeeklyTaskId) {
            item.innerHTML = `
                <div class="inline-edit-form">
                    <div class="inline-edit-row">
                        <input type="text" id="edit-work-title-${task.id}" class="form-input" value="${task.title}" required>
                        <input type="time" id="edit-work-time-${task.id}" class="form-input" value="${task.time || ''}">
                        <select id="edit-work-priority-${task.id}" class="select-input" style="padding: 0.5rem;">
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Thấp</option>
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Cao</option>
                        </select>
                    </div>
                    <input type="text" id="edit-work-note-${task.id}" class="form-input" value="${task.note || ''}" placeholder="Ghi chú...">
                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
                        <button class="btn btn-primary" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;" onclick="saveWeeklyTaskEdit(${task.id})">
                            <i class="fa-solid fa-check"></i> Lưu
                        </button>
                        <button class="btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;" onclick="cancelWeeklyTaskEdit()">
                            <i class="fa-solid fa-xmark"></i> Hủy
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Standard layout
            const priorityLabels = { low: 'Thấp', medium: 'T.Bình', high: 'Cao' };
            
            let metaHtml = '';
            if (task.time) {
                metaHtml += `<span><i class="fa-regular fa-clock"></i> ${task.time}</span>`;
                
                // Add "Sắp tới" badge for the closest upcoming task today
                if (isSelectedDayToday && task === closestUpcomingTask) {
                    metaHtml += `<span class="upcoming-badge"><span class="pulse-dot"></span> Sắp tới</span>`;
                }
                
                // Add countdown timer ONLY for today's tasks
                if (isSelectedDayToday) {
                    if (task.isDone) {
                        // No countdown if already done
                    } else {
                        const timeParts = task.time.split(':');
                        const taskTime = new Date();
                        taskTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
                        const diffMs = taskTime - now;
                        
                        if (diffMs > 0) {
                            const diffMins = Math.floor(diffMs / 60000);
                            const hours = Math.floor(diffMins / 60);
                            const mins = diffMins % 60;
                            metaHtml += `<span class="countdown-badge"><i class="fa-solid fa-hourglass-half"></i> Còn ${hours > 0 ? hours + 'h ' : ''}${mins}m</span>`;
                        } else {
                            metaHtml += `<span class="countdown-badge expired"><i class="fa-solid fa-clock-rotate-left"></i> Đã quá giờ</span>`;
                        }
                    }
                }
            }
            if (task.note) {
                metaHtml += `<span><i class="fa-regular fa-clipboard"></i> ${task.note}</span>`;
            }

            item.innerHTML = `
                <div class="detail-task-checkbox" onclick="toggleWeeklyTask('${state.selectedWorkPlannerDay}', ${task.id})">
                    <i class="fa-solid fa-check" style="font-size: 0.75rem; display: ${task.isDone ? 'block' : 'none'};"></i>
                </div>
                <div class="detail-task-details">
                    <div class="detail-task-title">${task.title}</div>
                    ${metaHtml ? `<div class="detail-task-meta">${metaHtml}</div>` : ''}
                </div>
                <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="startWeeklyTaskEdit(${task.id})" title="Sửa">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteWeeklyTask('${state.selectedWorkPlannerDay}', ${task.id})" title="Xóa">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
        }

        listContainer.appendChild(item);
    });
}

function startWeeklyTaskEdit(id) {
    state.editingWeeklyTaskId = id;
    renderWeeklyWorkPlanner();
}

function cancelWeeklyTaskEdit() {
    state.editingWeeklyTaskId = null;
    renderWeeklyWorkPlanner();
}

function saveWeeklyTaskEdit(id) {
    const title = document.getElementById(`edit-work-title-${id}`).value.trim();
    const time = document.getElementById(`edit-work-time-${id}`).value;
    const priority = document.getElementById(`edit-work-priority-${id}`).value;
    const note = document.getElementById(`edit-work-note-${id}`).value.trim();

    if (!title) {
        alert("Tên công việc không được trống!");
        return;
    }

    const tasks = state.weeklyWorkTasks[state.selectedWorkPlannerDay];
    if (tasks) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.title = title;
            task.time = time;
            task.priority = priority;
            task.note = note;
        }
    }
    state.editingWeeklyTaskId = null;
    saveStateToLocalStorage();
    renderWeeklyWorkPlanner();
}

function toggleWeeklyTask(dayKey, taskId) {
    const list = state.weeklyWorkTasks[dayKey];
    if (list) {
        const task = list.find(t => t.id === taskId);
        if (task) {
            task.isDone = !task.isDone;
            if (task.isDone) {
                playTickSound(800, 0.08);
            }
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();
        }
    }
}

function deleteWeeklyTask(dayKey, taskId) {
    const list = state.weeklyWorkTasks[dayKey];
    if (list) {
        if (confirm("Xóa công việc này khỏi lịch tuần?")) {
            state.weeklyWorkTasks[dayKey] = list.filter(t => t.id !== taskId);
            saveStateToLocalStorage();
            renderWeeklyWorkPlanner();
        }
    }
}

// Export functions to global scope so html inline events can find them
window.startWeeklyTaskEdit = startWeeklyTaskEdit;
window.cancelWeeklyTaskEdit = cancelWeeklyTaskEdit;
window.saveWeeklyTaskEdit = saveWeeklyTaskEdit;
window.toggleWeeklyTask = toggleWeeklyTask;
window.deleteWeeklyTask = deleteWeeklyTask;
window.setWeeklyWorkFilter = setWeeklyWorkFilter;
window.setWeeklyWorkAddMode = setWeeklyWorkAddMode;
window.executeScheduleCloning = executeScheduleCloning;
window.clearActiveDayTasks = clearActiveDayTasks;
window.openDayEventsMobileModal = openDayEventsMobileModal;
window.closeDayEventsMobileModal = closeDayEventsMobileModal;

// --- Event Modals Creation / Editing (Aura Calendar Events) ---
function openCreateEventModal(dateStr) {
    document.getElementById('modal-title-text').innerText = 'New Scheduler Block';
    document.getElementById('event-id-input').value = '';
    document.getElementById('event-title-input').value = '';
    document.getElementById('event-date-input').value = dateStr;
    document.getElementById('event-start-time').value = '09:00';
    document.getElementById('event-end-time').value = '10:00';
    document.getElementById('event-category-select').value = 'work';
    document.getElementById('event-delete-btn').style.display = 'none';
    document.getElementById('event-modal').classList.add('active');
}

function openEditEventModal(evt) {
    document.getElementById('modal-title-text').innerText = 'Modify Block';
    document.getElementById('event-id-input').value = evt.id;
    document.getElementById('event-title-input').value = evt.title;
    document.getElementById('event-date-input').value = evt.date;
    document.getElementById('event-start-time').value = evt.startTime;
    document.getElementById('event-end-time').value = evt.endTime;
    document.getElementById('event-category-select').value = evt.category;
    document.getElementById('event-delete-btn').style.display = 'block';
    document.getElementById('event-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('event-modal').classList.remove('active');
}

function openDayEventsMobileModal(dateStr) {
    const listContainer = document.getElementById('mobile-day-events-list');
    listContainer.innerHTML = '';

    // Convert dateStr (YYYY-MM-DD) to a human-readable display e.g. "Thứ Hai, 16/06"
    const parsedDate = new Date(dateStr);
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'numeric' };
    const dateFormatted = parsedDate.toLocaleDateString('vi-VN', dateOptions);
    document.getElementById('mobile-day-events-title').innerText = `Sự kiện: ${dateFormatted}`;

    const dayEvents = state.events.filter(e => e.date === dateStr);
    dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const categoryNames = { work: 'Công việc', personal: 'Cá nhân', health: 'Sức khỏe', learning: 'Học tập' };

    dayEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'mobile-event-item';
        
        item.innerHTML = `
            <div class="mobile-event-left">
                <div class="mobile-event-title">${evt.title}</div>
                <div class="mobile-event-time">
                    <i class="fa-regular fa-clock"></i> ${evt.startTime} - ${evt.endTime}
                </div>
            </div>
            <div class="mobile-event-right">
                <span class="mobile-event-category event-${evt.category}">${categoryNames[evt.category]}</span>
                <i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>
            </div>
        `;
        
        item.addEventListener('click', () => {
            closeDayEventsMobileModal();
            openEditEventModal(evt);
        });
        listContainer.appendChild(item);
    });

    // Handle "Add Event" button redirect
    const addBtn = document.getElementById('mobile-add-event-btn');
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    newAddBtn.addEventListener('click', () => {
        closeDayEventsMobileModal();
        openCreateEventModal(dateStr);
    });

    document.getElementById('day-events-mobile-modal').classList.add('active');
}

function closeDayEventsMobileModal() {
    document.getElementById('day-events-mobile-modal').classList.remove('active');
}

function saveEvent(e) {
    e.preventDefault();
    const id = document.getElementById('event-id-input').value;
    const title = document.getElementById('event-title-input').value.trim();
    const date = document.getElementById('event-date-input').value;
    const startTime = document.getElementById('event-start-time').value;
    const endTime = document.getElementById('event-end-time').value;
    const category = document.getElementById('event-category-select').value;

    if (!title || !date) return;

    if (id) {
        const evt = state.events.find(e => e.id === id);
        if (evt) {
            evt.title = title;
            evt.date = date;
            evt.startTime = startTime;
            evt.endTime = endTime;
            evt.category = category;
        }
    } else {
        state.events.push({
            id: 'event_' + Date.now(),
            title, date, startTime, endTime, category
        });
    }

    saveStateToLocalStorage();
    closeModal();
    renderApp();
}

function deleteEvent() {
    const id = document.getElementById('event-id-input').value;
    if (id) {
        state.events = state.events.filter(e => e.id !== id);
        saveStateToLocalStorage();
        closeModal();
        renderApp();
    }
}

// --- Pomodoro Focus Timer Logic ---
function togglePomodoro() {
    const btn = document.getElementById('timer-toggle-btn');
    if (state.pomodoro.isRunning) {
        clearInterval(state.pomodoro.intervalId);
        state.pomodoro.isRunning = false;
        btn.innerHTML = `<i class="fa-solid fa-play"></i> Resume`;
        document.getElementById('timer-status-text').innerText = 'Paused';
    } else {
        state.pomodoro.isRunning = true;
        btn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;
        document.getElementById('timer-status-text').innerText = state.pomodoro.mode === 'work' ? 'Focusing...' : 'Taking a break...';
        
        state.pomodoro.intervalId = setInterval(() => {
            state.pomodoro.timeLeft--;
            updateTimerDisplay();

            if (state.pomodoro.timeLeft <= 0) {
                clearInterval(state.pomodoro.intervalId);
                state.pomodoro.isRunning = false;
                playAlarmSound();

                if (state.pomodoro.mode === 'work') {
                    state.pomodoro.mode = 'break';
                    state.pomodoro.timeLeft = state.pomodoro.durationBreak;
                    alert("Time's up! Great focus block. Time for a well-deserved break! 🎉");
                } else {
                    state.pomodoro.mode = 'work';
                    state.pomodoro.timeLeft = state.pomodoro.durationWork;
                    alert("Break is over! Ready to get back to flow state? 💪");
                }
                resetPomodoroUIState();
            }
        }, 1000);
    }
}

function resetPomodoro() {
    clearInterval(state.pomodoro.intervalId);
    state.pomodoro.isRunning = false;
    state.pomodoro.mode = 'work';
    state.pomodoro.timeLeft = state.pomodoro.durationWork;
    resetPomodoroUIState();
}

function resetPomodoroUIState() {
    updateTimerDisplay();
    document.getElementById('timer-toggle-btn').innerHTML = `<i class="fa-solid fa-play"></i> Start`;
    document.getElementById('timer-status-text').innerText = state.pomodoro.mode === 'work' ? 'Ready to Focus' : 'Taking a break';
}

function updateTimerDisplay() {
    const mins = Math.floor(state.pomodoro.timeLeft / 60);
    const secs = state.pomodoro.timeLeft % 60;
    document.getElementById('timer-display').innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// --- Web Audio sound effects ---
function playTickSound(frequency = 600, duration = 0.1) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn("Audio Context blocked.");
    }
}

function playAlarmSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.15);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime + index * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + index * 0.15 + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + index * 0.15);
            osc.stop(audioCtx.currentTime + index * 0.15 + 0.3);
        });
    } catch (e) {
        console.warn("Audio Context blocked.");
    }
}

// --- Data Backup & Recovery (Import/Export JSON) ---
function exportData() {
    const backupStr = JSON.stringify(state, null, 2);
    const blob = new Blob([backupStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura_planner_backup_${getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (Array.isArray(parsed.events) && Array.isArray(parsed.tasks) && Array.isArray(parsed.habits) && typeof parsed.weeklyWorkTasks === 'object') {
                state.events = parsed.events;
                state.tasks = parsed.tasks;
                state.habits = parsed.habits;
                state.weeklyWorkTasks = parsed.weeklyWorkTasks;
                state.scratchpad = parsed.scratchpad || '';
                state.selectedWorkPlannerDay = parsed.selectedWorkPlannerDay || getTodayDayName();
                
                saveStateToLocalStorage();
                document.getElementById('scratchpad').value = state.scratchpad;
                
                // Refresh active view
                switchView(state.activeView);
                alert("Backup restored successfully! 🌟");
            } else {
                alert("Invalid backup file structure.");
            }
        } catch (err) {
            alert("Error parsing backup file.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// --- ================== CLOUD DATA SYNC & AUTHENTICATION ================== ---
let currentAuthTab = 'login';
let syncIntervalId = null;

function switchAuthTab(mode) {
    currentAuthTab = mode;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtnText = document.getElementById('auth-btn-text');
    const errorText = document.getElementById('auth-error-text');

    errorText.classList.add('hidden');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        submitBtnText.innerText = 'Đăng nhập';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        submitBtnText.innerText = 'Tạo tài khoản';
    }
}

// Export switchAuthTab to window so inline onclick works
window.switchAuthTab = switchAuthTab;

async function handleAuthSubmit(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const errorText = document.getElementById('auth-error-text');
    const spinner = document.getElementById('auth-loading-spinner');
    const submitBtn = document.getElementById('auth-submit-btn');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    errorText.classList.add('hidden');
    spinner.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: currentAuthTab,
                username,
                password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Đã xảy ra lỗi không xác định.');
        }

        if (currentAuthTab === 'register') {
            alert('Tạo tài khoản thành công! Bây giờ bạn có thể đăng nhập.');
            switchAuthTab('login');
            passwordInput.value = '';
            spinner.classList.add('hidden');
            submitBtn.disabled = false;
        } else {
            // Login successful
            state.userSession = { username, password };
            localStorage.setItem('aura_planner_session', JSON.stringify(state.userSession));
            
            // Apply loaded cloud data if it exists
            if (result.data) {
                applyCloudState(result.data);
            }

            document.getElementById('auth-overlay').classList.add('hidden');
            passwordInput.value = '';
            usernameInput.value = '';
            spinner.classList.add('hidden');
            submitBtn.disabled = false;

            // Trigger view redraws
            switchView(state.activeView);
            startBackgroundSync();
            
            // Initial save to make sure everything matches
            saveStateToLocalStorage();
        }

    } catch (err) {
        console.error("Auth Error:", err);
        errorText.innerText = err.message;
        errorText.classList.remove('hidden');
        spinner.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

function handleLogout() {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản của mình?")) {
        state.userSession = null;
        localStorage.removeItem('aura_planner_session');
        stopBackgroundSync();

        // Clear local planner state to default
        state.events = [];
        state.tasks = [];
        state.habits = [];
        state.scratchpad = '';
        state.weeklyWorkTasks = {
            monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
        };
        state.lastUpdated = 0;
        localStorage.removeItem('aura_planner_state');
        document.getElementById('scratchpad').value = '';

        // Show Auth overlay
        document.getElementById('auth-overlay').classList.remove('hidden');
    }
}

async function syncWithCloud() {
    if (!state.userSession) return;

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sync',
                username: state.userSession.username,
                password: state.userSession.password,
                clientState: {
                    activeView: state.activeView,
                    events: state.events,
                    tasks: state.tasks,
                    habits: state.habits,
                    scratchpad: state.scratchpad,
                    selectedWorkPlannerDay: state.selectedWorkPlannerDay,
                    weeklyWorkFilter: state.weeklyWorkFilter,
                    lastOpenedWeek: state.lastOpenedWeek,
                    weeklyWorkAddMode: state.weeklyWorkAddMode,
                    isScheduleToolsExpanded: state.isScheduleToolsExpanded,
                    weeklyWorkTasks: state.weeklyWorkTasks,
                    lastUpdated: state.lastUpdated
                }
            })
        });

        const result = await response.json();
        if (response.ok && result.success && result.data) {
            if (result.status === 'updated_client') {
                console.log("[Sync] Cloud data is newer. Applying to client...");
                applyCloudState(result.data);
            } else {
                console.log("[Sync] Local data pushed successfully to cloud.");
            }
        }
    } catch (err) {
        console.warn("[Sync] Cloud sync failed (offline or local server):", err);
    }
}

function applyCloudState(cloudState) {
    state.events = cloudState.events || [];
    state.tasks = cloudState.tasks || [];
    state.habits = cloudState.habits || [];
    state.scratchpad = cloudState.scratchpad || '';
    state.selectedWorkPlannerDay = cloudState.selectedWorkPlannerDay || 'monday';
    state.weeklyWorkFilter = cloudState.weeklyWorkFilter || 'all';
    state.lastOpenedWeek = cloudState.lastOpenedWeek || '';
    state.weeklyWorkAddMode = cloudState.weeklyWorkAddMode || 'ai';
    state.isScheduleToolsExpanded = cloudState.isScheduleToolsExpanded || false;
    state.weeklyWorkTasks = cloudState.weeklyWorkTasks || {
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
    };
    state.lastUpdated = cloudState.lastUpdated || Date.now();

    // Save locally
    const dataToSave = {
        activeView: state.activeView,
        events: state.events,
        tasks: state.tasks,
        habits: state.habits,
        scratchpad: state.scratchpad,
        selectedWorkPlannerDay: state.selectedWorkPlannerDay,
        weeklyWorkFilter: state.weeklyWorkFilter,
        lastOpenedWeek: state.lastOpenedWeek,
        weeklyWorkAddMode: state.weeklyWorkAddMode,
        isScheduleToolsExpanded: state.isScheduleToolsExpanded,
        weeklyWorkTasks: state.weeklyWorkTasks,
        lastUpdated: state.lastUpdated
    };
    localStorage.setItem('aura_planner_state', JSON.stringify(dataToSave));

    // Update UI elements
    document.getElementById('scratchpad').value = state.scratchpad;
    if (state.activeView === 'calendar') {
        renderApp();
    } else if (state.activeView === 'work-planner') {
        renderWeeklyWorkPlanner();
    }
}

function checkUserSessionOnStart() {
    const sessionData = localStorage.getItem('aura_planner_session');
    if (sessionData) {
        try {
            state.userSession = JSON.parse(sessionData);
            document.getElementById('auth-overlay').classList.add('hidden');
            
            // Trigger initial sync to pull any updates
            syncWithCloud();
            startBackgroundSync();
        } catch (e) {
            console.error("Invalid session format:", e);
            localStorage.removeItem('aura_planner_session');
            document.getElementById('auth-overlay').classList.remove('hidden');
        }
    } else {
        document.getElementById('auth-overlay').classList.remove('hidden');
    }
}

function startBackgroundSync() {
    stopBackgroundSync();
    // Sync with cloud every 30 seconds
    syncIntervalId = setInterval(syncWithCloud, 30000);

    // Also sync immediately when browser tab gains focus (e.g. user opens phone app)
    window.addEventListener('focus', syncWithCloud);
}

function stopBackgroundSync() {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
    window.removeEventListener('focus', syncWithCloud);
}
