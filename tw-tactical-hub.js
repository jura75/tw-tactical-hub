(function() {
    // Функция для автоматического определения текущего мира из игры
    function getCurrentWorldServer() {
        const host = window.location.host;
        const match = host.match(/^(ru\d+)/i);
        if (match && match[1]) {
            return match[1];
        }
        return 'ru103';
    }

    const currentWorld = getCurrentWorldServer();
    const externalTimerUrl = `https://raw.githack.com/jura75/tw-attack-timer.js/main/tw-attack-timer.js`;

    const isConfirmationPage = window.location.href.includes('screen=place') && (document.querySelector('#troop_confirm_submit') || document.forms['command-form'] || document.getElementById('btn_confirm'));

    if (isConfirmationPage) {
        fetch(externalTimerUrl)
            .then(r => r.text())
            .then(code => {
                try { eval(code); } catch(e) { console.error('Ошибка выполнения таймера:', e); }
            })
            .catch(err => console.error('Не удалось загрузить таймер с GitHub:', err));
    }

    let panel = document.getElementById('custom-tactical-hub');
    const isAlreadyOpen = !!panel;

    let savedPlans = localStorage.getItem('tw_hub_planned_orders');
    let plannedOrders = savedPlans ? JSON.parse(savedPlans) : [];
    
    const nowInitMs = new Date().getTime();
    plannedOrders = plannedOrders.filter(order => (order.sendMs || 0) >= nowInitMs);
    localStorage.setItem('tw_hub_planned_orders', JSON.stringify(plannedOrders));
    
    let savedArchersMode = localStorage.getItem('tw_hub_archers_mode');
    let hasArchers = savedArchersMode !== null ? savedArchersMode === 'true' : true;

    // Состояние чекбокса скрытия подкреплений
    let hideSupportSaved = localStorage.getItem('tw_hub_hide_support');
    let hideSupportMode = hideSupportSaved !== null ? hideSupportSaved === 'true' : false;

    const unitsWithoutArchers = {
        names: ['Копья', 'Мечи', 'Топоры', 'Развед', 'ЛК', 'ТК', 'Тараны', 'Каты', 'Паладин', 'Двор'],
        speeds: [1080, 1320, 1080, 540, 600, 660, 1800, 1800, 600, 2100]
    };

    const unitsWithArchers = {
        names: ['Копья', 'Мечи', 'Топоры', 'Лучник', 'Развед', 'ЛК', 'КЛ', 'ТК', 'Тараны', 'Каты', 'Паладин', 'Двор'],
        speeds: [1080, 1320, 1080, 1080, 540, 600, 600, 660, 1800, 1800, 600, 2100]
    };

    let activeUnitConfig = hasArchers ? unitsWithArchers : unitsWithoutArchers;
    let UNIT_COUNT = activeUnitConfig.names.length;
    let unitNames = activeUnitConfig.names;
    let baseUnitSpeeds = activeUnitConfig.speeds;

    let savedFilters = localStorage.getItem('tw_hub_unit_filters');
    let unitFilterStates = savedFilters ? JSON.parse(savedFilters) : Array(UNIT_COUNT).fill(true);
    if (unitFilterStates.length !== UNIT_COUNT) unitFilterStates = Array(UNIT_COUNT).fill(true);

    let savedMinUnits = localStorage.getItem('tw_hub_min_units');
    let unitMinValues = savedMinUnits ? JSON.parse(savedMinUnits) : Array(UNIT_COUNT).fill(0);
    if (unitMinValues.length !== UNIT_COUNT) unitMinValues = Array(UNIT_COUNT).fill(0);

    let savedTcTargets = localStorage.getItem('tw_hub_tc_targets') || '';
    let isMobileMode = localStorage.getItem('tw_hub_mobile_mode') === 'true';
    let worldSpeed = parseFloat(localStorage.getItem('tw_hub_world_speed')) || 1.0;
    let hourAdjustment = parseInt(localStorage.getItem('tw_hub_hour_adj')) || 0;

    function getAdjustedSpeeds() {
        return baseUnitSpeeds.map(speed => speed / worldSpeed);
    }
    let unitSpeeds = getAdjustedSpeeds();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const defDateStr = `${String(tomorrow.getDate()).padStart(2,'0')}.${String(tomorrow.getMonth()+1).padStart(2,'0')}.${tomorrow.getFullYear()} 08:00:00`;
    
    let savedTcArrival = localStorage.getItem('tw_hub_tc_arrival') || defDateStr;
    let savedMaxTarget = localStorage.getItem('tw_hub_tc_max_target') || '1';
    let savedMaxSource = localStorage.getItem('tw_hub_tc_max_source') || '1';

    let currentActiveTab = localStorage.getItem('tw_hub_active_tab') || 'incomings';
    if (['hub', 'tribe', 'stats'].includes(currentActiveTab)) currentActiveTab = 'incomings';

    let savedTcPairs = localStorage.getItem('tw_hub_persisted_tc_pairs');
    let savedTcArrivalMs = localStorage.getItem('tw_hub_persisted_tc_arrival_ms');
    let savedIncAttacks = localStorage.getItem('tw_hub_persisted_inc_attacks');
    let savedIncVillages = localStorage.getItem('tw_hub_persisted_inc_villages');
    let savedIncSelectedAttack = localStorage.getItem('tw_hub_persisted_inc_sel_attack');
    let savedIncOptions = localStorage.getItem('tw_hub_persisted_inc_options');

    let parsedTcPairs = savedTcPairs ? JSON.parse(savedTcPairs) : null;
    if (parsedTcPairs) parsedTcPairs = parsedTcPairs.filter(p => (p.sendMs || 0) >= new Date().getTime());

    let tcCache = { selectedPairs: parsedTcPairs, arrivalDateMs: savedTcArrivalMs ? parseInt(savedTcArrivalMs) : null, cachedVillages: null };
    let parsedIncOpts = savedIncOptions ? JSON.parse(savedIncOptions) : null;
    if (parsedIncOpts) parsedIncOpts = parsedIncOpts.filter(o => (o.sendMs || 0) >= new Date().getTime());

    let incCache = { attacks: savedIncAttacks ? JSON.parse(savedIncAttacks) : null, playerVillages: savedIncVillages ? JSON.parse(savedIncVillages) : null, selectedAttack: savedIncSelectedAttack ? JSON.parse(savedIncSelectedAttack) : null, availableOptions: parsedIncOpts };

    if (incCache.selectedAttack && incCache.selectedAttack.arrivalDate) {
        incCache.selectedAttack.arrivalDate = new Date(incCache.selectedAttack.arrivalDate);
    }

    function persistTcState() {
        if (tcCache.selectedPairs) {
            localStorage.setItem('tw_hub_persisted_tc_pairs', JSON.stringify(tcCache.selectedPairs));
            localStorage.setItem('tw_hub_persisted_tc_arrival_ms', tcCache.arrivalDateMs || '');
        } else {
            localStorage.removeItem('tw_hub_persisted_tc_pairs');
            localStorage.removeItem('tw_hub_persisted_tc_arrival_ms');
        }
    }

    function persistIncState() {
        if (incCache.attacks) localStorage.setItem('tw_hub_persisted_inc_attacks', JSON.stringify(incCache.attacks));
        else localStorage.removeItem('tw_hub_persisted_inc_attacks');

        if (incCache.playerVillages) localStorage.setItem('tw_hub_persisted_inc_villages', JSON.stringify(incCache.playerVillages));
        else localStorage.removeItem('tw_hub_persisted_inc_villages');

        if (incCache.selectedAttack) localStorage.setItem('tw_hub_persisted_inc_sel_attack', JSON.stringify(incCache.selectedAttack));
        else localStorage.removeItem('tw_hub_persisted_inc_sel_attack');

        if (incCache.availableOptions) localStorage.setItem('tw_hub_persisted_inc_options', JSON.stringify(incCache.availableOptions));
        else localStorage.removeItem('tw_hub_persisted_inc_options');
    }

    function runExternalTimer() {
        fetch(externalTimerUrl)
            .then(r => r.text())
            .then(code => { try { eval(code); } catch(e) { console.error('Ошибка таймера:', e); } })
            .catch(err => console.error('Не удалось загрузить таймер:', err));
    }

    function formatDateStr(date) {
        let d = String(date.getDate()).padStart(2, '0');
        let m = String(date.getMonth() + 1).padStart(2, '0');
        let y = date.getFullYear();
        let h = String(date.getHours()).padStart(2, '0');
        let min = String(date.getMinutes()).padStart(2, '0');
        let s = String(date.getSeconds()).padStart(2, '0');
        return `${d}.${m}.${y} ${h}:${min}:${s}`;
    }

    function formatDuration(ms) {
        if (ms < 0) ms = 0;
        let totalSec = Math.round(ms / 1000);
        let h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        let m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        let s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function savePlans() {
        const nowMs = new Date().getTime();
        plannedOrders = plannedOrders.filter(order => (order.sendMs || 0) >= nowMs);
        localStorage.setItem('tw_hub_planned_orders', JSON.stringify(plannedOrders));
        const countElem = document.getElementById('plan-count');
        if (countElem) countElem.innerText = plannedOrders.length;
    }

    function parseArrivalTime(arrivalStr) {
        const now = new Date();
        if (!arrivalStr) return new Date(now.getTime());
        const cleanStr = arrivalStr.trim();
        
        let fullDateMatch = cleanStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:[\.:](\d{1,3}))?/);
        if (fullDateMatch) {
            let day = parseInt(fullDateMatch[1], 10);
            let month = parseInt(fullDateMatch[2], 10) - 1;
            let year = parseInt(fullDateMatch[3], 10);
            let hours = parseInt(fullDateMatch[4], 10) + hourAdjustment;
            let minutes = parseInt(fullDateMatch[5], 10);
            let seconds = parseInt(fullDateMatch[6], 10);
            let ms = fullDateMatch[7] ? parseInt(fullDateMatch[7].padEnd(3, '0'), 10) : 0;
            return new Date(year, month, day, hours, minutes, seconds, ms);
        }

        const dateTimeMatch = /(?:[A-Z][a-z]{2}\s+\d{1,2},\s*\d{0,4}\s+|сегодня\s+в\s+|завтра\s+в\s+|today\s+at\s+|tomorrow\s+at\s+)\d{1,2}:\d{2}:\d{2}:?\.?\d{0,3}/i;
        if (dateTimeMatch.test(cleanStr)) {
            let timeMatch = cleanStr.match(/(\d{1,2}):(\d{2}):(\d{2})(?:[\.:](\d{1,3}))?/);
            if (timeMatch) {
                let targetDate = new Date(now.getTime());
                let hours = parseInt(timeMatch[1], 10) + hourAdjustment;
                let minutes = parseInt(timeMatch[2], 10);
                let seconds = parseInt(timeMatch[3], 10);
                let ms = timeMatch[4] ? parseInt(timeMatch[4].padEnd(3, '0'), 10) : 0;
                
                targetDate.setHours(hours, minutes, seconds, ms);
                if (cleanStr.toLowerCase().includes('завтра') || cleanStr.toLowerCase().includes('tomorrow') || targetDate.getTime() <= now.getTime()) {
                    if (cleanStr.toLowerCase().includes('завтра') || cleanStr.toLowerCase().includes('tomorrow') || hours < now.getHours()) {
                        targetDate.setDate(targetDate.getDate() + 1);
                    }
                }
                return targetDate;
            }
        }
        
        let timeMatch = cleanStr.match(/(\d{2}):(\d{2}):(\d{2})(?:[\.:](\d{1,3}))?/);
        if (timeMatch) {
            let targetDate = new Date(now.getTime());
            let hours = parseInt(timeMatch[1], 10) + hourAdjustment;
            let minutes = parseInt(timeMatch[2], 10);
            let seconds = parseInt(timeMatch[3], 10);
            let ms = timeMatch[4] ? parseInt(timeMatch[4].padEnd(3, '0'), 10) : 0;
            
            targetDate.setHours(hours, minutes, seconds, ms);
            if (cleanStr.toLowerCase().includes('завтра') || targetDate.getTime() <= now.getTime()) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            return targetDate;
        }
        return new Date(now.getTime());
    }

    if (isAlreadyOpen) {
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'flex';
            initStaticPanes();
            switchTab(currentActiveTab, false);
        } else {
            panel.style.display = 'none';
        }
        return;
    } else {
        panel = document.createElement('div');
        panel.id = 'custom-tactical-hub';
        document.body.appendChild(panel);
    }

    function applyPanelStyles(mobile) {
        if (mobile) {
            panel.style.cssText = `
                position: fixed; top: 10px; right: 10px; width: 420px; max-width: 95vw; height: 85vh; max-height: 90vh;
                background: #2b1d0c; border: 2px solid #7d510f; box-shadow: 0 0 15px rgba(0,0,0,0.8);
                z-index: 99999; font-family: Verdana, Arial, sans-serif; color: #f4e4bc; border-radius: 4px;
                display: flex; flex-direction: column; overflow: hidden;
            `;
        } else {
            panel.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%); width: 1400px; min-width: 650px;
                height: 680px; min-height: 400px; max-height: 95vh; max-width: 98vw;
                background: #2b1d0c; border: 4px solid #7d510f; box-shadow: 0 0 25px rgba(0,0,0,0.9);
                z-index: 99999; font-family: Verdana, Arial, sans-serif; color: #f4e4bc; border-radius: 4px;
                display: flex; flex-direction: column; overflow: hidden;
            `;
        }
    }

    applyPanelStyles(isMobileMode);

    function buildFiltersHtml() {
        let html = '';
        for (let u = 0; u < UNIT_COUNT; u++) {
            html += `
                <div style="display: flex; align-items: center; gap: 2px; background: #2b1d0c; padding: 2px 4px; border: 1px solid #7d510f; border-radius: 3px;">
                    <label style="display: flex; align-items: center; gap: 2px; cursor: pointer; font-size: 10px;">
                        <input type="checkbox" class="global-unit-filter" data-unit-idx="${u}" ${unitFilterStates[u] ? 'checked' : ''} style="cursor: pointer; margin: 0;">
                        <span style="color: #f4e4bc;">${unitNames[u]}</span>
                    </label>
                    <input type="number" class="global-min-unit-input" data-unit-idx="${u}" value="${unitMinValues[u]}" min="0" placeholder="мин" title="Минимум войск" style="width: 30px; font-size: 9px; text-align: center; background: #fff; border: 1px solid #7d510f; border-radius: 2px; padding: 1px; color: #000;">
                </div>
            `;
        }
        return html;
    }

    panel.innerHTML = `
        <div style="background: #1a1006; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7d510f; cursor: move;" id="hub-drag-header">
            <div>
                <b style="font-size: 13px; color: #f4e4bc;">Custom Tactical Hub</b>
                <span style="font-size: 10px; color: #a98a5c; margin-left: 8px;">v6.9.60 (${currentWorld})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 4px; background: #3b2812; padding: 2px 6px; border: 1px solid #7d510f; border-radius: 3px;" title="Скорость текущего мира игры">
                    <label style="font-size: 10px; color: #f4e4bc; font-weight: bold;">Скорость:</label>
                    <input type="range" id="world-speed-slider" min="0.5" max="3.0" step="0.1" value="${worldSpeed}" style="width: 45px; height: 10px; cursor: pointer;">
                    <input type="number" id="world-speed-input" min="0.1" max="10" step="0.1" value="${worldSpeed}" style="width: 35px; font-size: 10px; text-align: center; background: #fff; border: 1px solid #7d510f; border-radius: 2px; color: #000;">
                </div>
                <label style="font-size: 10px; color: #f4e4bc; cursor: pointer; display: flex; align-items: center; gap: 3px; background: #3b2812; padding: 2px 6px; border: 1px solid #7d510f; border-radius: 3px;" title="Мир с лучниками">
                    <input type="checkbox" id="archers-mode-chk" ${hasArchers ? 'checked' : ''} style="cursor: pointer; margin: 0;"> 🏹 Луки
                </label>
                <label style="font-size: 10px; color: #f4e4bc; cursor: pointer; display: flex; align-items: center; gap: 3px; background: #3b2812; padding: 2px 6px; border: 1px solid #7d510f; border-radius: 3px;" title="Компактный мобильный вид">
                    <input type="checkbox" id="hub-mobile-mode-chk" ${isMobileMode ? 'checked' : ''} style="cursor: pointer; margin: 0;"> 📱 Моб.
                </label>
                <button id="hub-run-timer-btn" style="background: #4a7c59; border: 1px solid #284731; color: #fff; font-weight: bold; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-size: 11px;">⚡ Таймер</button>
                <button id="hub-scan-btn" style="background: #c19a5b; border: 1px solid #5a3b0c; color: #2b1d0c; font-weight: bold; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-size: 11px;">Сканировать</button>
                <button id="hub-close-btn" style="background: #a63a3a; border: 1px solid #5a0c0c; color: #fff; font-weight: bold; padding: 3px 6px; cursor: pointer; border-radius: 3px; font-size: 11px;">Скрыть</button>
            </div>
        </div>
        
        <div id="hub-filters-container" style="background: #3b2812; padding: 6px 12px; display: flex; align-items: center; gap: 4px; border-bottom: 2px solid #7d510f; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: bold; color: #e3d2ab; margin-right: 2px;">Фильтр юнитов:</span>
            <div id="global-filters-inner" style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                ${buildFiltersHtml()}
            </div>
        </div>

        <div style="background: #2b1d0c; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #5a3b0c;">
            <div style="display: flex; gap: 6px;">
                <button class="hub-tab-btn" data-tab="incomings" style="background: #2b1d0c; color: #e3d2ab; border: 1px solid #7d510f; padding: 4px 12px; font-weight: bold; cursor: pointer; border-radius: 3px; font-size: 11px;">Входящие</button>
                <button class="hub-tab-btn" data-tab="timecoords" style="background: #2b1d0c; color: #e3d2ab; border: 1px solid #7d510f; padding: 4px 12px; font-weight: bold; cursor: pointer; border-radius: 3px; font-size: 11px;">Тайм-коры</button>
                <button class="hub-tab-btn" data-tab="plan" style="background: #2b1d0c; color: #e3d2ab; border: 1px solid #7d510f; padding: 4px 12px; font-weight: bold; cursor: pointer; border-radius: 3px; font-size: 11px;">План (<span id="plan-count">${plannedOrders.length}</span>)</button>
            </div>
            <div>
                <label style="font-size: 11px; color: #f4e4bc; cursor: pointer; display: flex; align-items: center; gap: 4px; background: #3b2812; padding: 3px 8px; border: 1px solid #7d510f; border-radius: 3px;">
                    <input type="checkbox" id="hub-hide-support-chk" ${hideSupportMode ? 'checked' : ''} style="cursor: pointer; margin: 0;"> 🛡️ Скрыть подкрепления
                </label>
            </div>
        </div>
        <div id="hub-body" style="padding: 12px; background: #f4e4bc; color: #2b1d0c; flex-grow: 1; overflow-y: auto; min-height: 250px;">
            <div id="tab-pane-incomings" class="hub-pane" style="display:none;"></div>
            <div id="tab-pane-timecoords" class="hub-pane" style="display:none;"></div>
            <div id="tab-pane-plan" class="hub-pane" style="display:none;"></div>
        </div>
        <div style="background: #1a1006; padding: 4px 12px; font-size: 10px; color: #a98a5c; border-top: 1px solid #7d510f; display: flex; justify-content: space-between;">
            <span id="hub-status">Статус: Готов (${currentWorld})</span>
            <span>Скорость мира: <span id="footer-speed-val">${worldSpeed}</span></span>
        </div>
    `;

    const worldSpeedSlider = document.getElementById('world-speed-slider');
    const worldSpeedInput = document.getElementById('world-speed-input');
    const footerSpeedVal = document.getElementById('footer-speed-val');
    const archersModeChk = document.getElementById('archers-mode-chk');
    const hideSupportChk = document.getElementById('hub-hide-support-chk');

    hideSupportChk.onchange = function() {
        hideSupportMode = this.checked;
        localStorage.setItem('tw_hub_hide_support', hideSupportMode);
        if (currentActiveTab === 'incomings' && incCache.attacks) {
            renderIncomingsList(document.getElementById('tab-pane-incomings'), incCache.attacks);
        }
    };

    function bindFilterEvents() {
        panel.querySelectorAll('.global-unit-filter').forEach(chk => {
            chk.onchange = function() {
                let uIdx = parseInt(this.getAttribute('data-unit-idx'));
                unitFilterStates[uIdx] = this.checked;
                localStorage.setItem('tw_hub_unit_filters', JSON.stringify(unitFilterStates));
                
                if (currentActiveTab === 'incomings' && incCache.selectedAttack) {
                    generateSrezOptions(incCache.selectedAttack);
                    renderSrezView(document.getElementById('tab-pane-incomings'), incCache.selectedAttack, incCache.availableOptions);
                }
            };
        });

        panel.querySelectorAll('.global-min-unit-input').forEach(inp => {
            inp.oninput = function() {
                let uIdx = parseInt(this.getAttribute('data-unit-idx'));
                let val = parseInt(this.value);
                unitMinValues[uIdx] = isNaN(val) ? 0 : val;
                localStorage.setItem('tw_hub_min_units', JSON.stringify(unitMinValues));

                if (currentActiveTab === 'incomings' && incCache.selectedAttack) {
                    generateSrezOptions(incCache.selectedAttack);
                    renderSrezView(document.getElementById('tab-pane-incomings'), incCache.selectedAttack, incCache.availableOptions);
                }
            };
        });
    }

    archersModeChk.onchange = function() {
        hasArchers = this.checked;
        localStorage.setItem('tw_hub_archers_mode', hasArchers);

        activeUnitConfig = hasArchers ? unitsWithArchers : unitsWithoutArchers;
        UNIT_COUNT = activeUnitConfig.names.length;
        unitNames = activeUnitConfig.names;
        baseUnitSpeeds = activeUnitConfig.speeds;

        unitFilterStates = Array(UNIT_COUNT).fill(true);
        unitMinValues = Array(UNIT_COUNT).fill(0);
        localStorage.setItem('tw_hub_unit_filters', JSON.stringify(unitFilterStates));
        localStorage.setItem('tw_hub_min_units', JSON.stringify(unitMinValues));

        unitSpeeds = getAdjustedSpeeds();

        document.getElementById('global-filters-inner').innerHTML = buildFiltersHtml();
        bindFilterEvents();

        incCache.cachedVillages = null;
        tcCache.cachedVillages = null;
        tcCache.selectedPairs = null;
        incCache.selectedAttack = null;
        incCache.availableOptions = null;
        persistTcState();
        persistIncState();

        initStaticPanes();
        document.getElementById('hub-status').innerText = `Статус: Режим сменен (${hasArchers ? 'с луками' : 'без луков'})`;
    };

    bindFilterEvents();

    function updateWorldSpeed(newSpeed) {
        worldSpeed = Math.max(0.1, parseFloat(newSpeed) || 1.0);
        worldSpeedSlider.value = worldSpeed;
        worldSpeedInput.value = worldSpeed;
        footerSpeedVal.innerText = worldSpeed;
        localStorage.setItem('tw_hub_world_speed', worldSpeed);
        unitSpeeds = getAdjustedSpeeds();

        if (currentActiveTab === 'timecoords' && tcCache.selectedPairs) {
            document.getElementById('tc-generate-btn').click();
        } else if (currentActiveTab === 'incomings' && incCache.selectedAttack && incCache.availableOptions) {
            generateSrezOptions(incCache.selectedAttack);
            renderSrezView(document.getElementById('tab-pane-incomings'), incCache.selectedAttack, incCache.availableOptions);
        }
    }

    worldSpeedSlider.oninput = function() { updateWorldSpeed(this.value); };
    worldSpeedInput.oninput = function() { updateWorldSpeed(this.value); };

    document.getElementById('hub-mobile-mode-chk').onchange = function() {
        isMobileMode = this.checked;
        localStorage.setItem('tw_hub_mobile_mode', isMobileMode);
        applyPanelStyles(isMobileMode);
    };

    let isResizing = false;
    let resizeDir = '', startX, startY, startWidth, startHeight, startLeft, startTop;

    panel.addEventListener('mousedown', (e) => {
        if (isMobileMode) return;
        const rect = panel.getBoundingClientRect();
        const b = 8;
        let x = e.clientX - rect.left, y = e.clientY - rect.top, w = rect.width, h = rect.height;

        let leftEdge = x < b, rightEdge = x > w - b, topEdge = y < b, bottomEdge = y > h - b;

        if (leftEdge || rightEdge || topEdge || bottomEdge) {
            isResizing = true;
            resizeDir = '';
            if (topEdge) resizeDir += 'top';
            if (bottomEdge) resizeDir += 'bottom';
            if (leftEdge) resizeDir += 'left';
            if (rightEdge) resizeDir += 'right';

            startX = e.clientX; startY = e.clientY;
            startWidth = w; startHeight = h;
            startLeft = rect.left; startTop = rect.top;
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing || isMobileMode) return;
        let dx = e.clientX - startX, dy = e.clientY - startY;
        let newWidth = Math.max(650, startWidth + (resizeDir.includes('right') ? dx : (resizeDir.includes('left') ? -dx : 0)));
        let newHeight = Math.max(400, startHeight + (resizeDir.includes('bottom') ? dy : (resizeDir.includes('top') ? -dy : 0)));

        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
        if (resizeDir.includes('left')) panel.style.left = (startLeft + dx) + 'px';
        if (resizeDir.includes('top')) panel.style.top = (startTop + dy) + 'px';
        panel.style.transform = 'none';
    });

    window.addEventListener('mouseup', () => { isResizing = false; });

    let isDragging = false, dragStartX, dragStartY;
    const header = document.getElementById('hub-drag-header');

    header.addEventListener('mousedown', (e) => {
        if (['BUTTON', 'INPUT', 'LABEL'].includes(e.target.tagName)) return;
        isDragging = true;
        dragStartX = e.clientX - panel.getBoundingClientRect().left;
        dragStartY = e.clientY - panel.getBoundingClientRect().top;
        panel.style.transform = 'none';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - dragStartX) + 'px';
        panel.style.top = (e.clientY - dragStartY) + 'px';
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('hub-close-btn').onclick = () => { panel.style.display = 'none'; };
    document.getElementById('hub-run-timer-btn').onclick = () => { runExternalTimer(); };

    function initStaticPanes() {
        renderTimeCoordsTab(document.getElementById('tab-pane-timecoords'));
        renderPlanTab(document.getElementById('tab-pane-plan'));
        
        if (currentActiveTab === 'incomings') {
            const incPane = document.getElementById('tab-pane-incomings');
            if (incCache.selectedAttack && incCache.availableOptions) {
                renderSrezView(incPane, incCache.selectedAttack, incCache.availableOptions);
            } else if (incCache.attacks && incCache.attacks.length > 0) {
                renderIncomingsList(incPane, incCache.attacks);
            }
        }
    }

    function switchTab(tabName, saveToStorage = true) {
        currentActiveTab = tabName;
        if (saveToStorage) localStorage.setItem('tw_hub_active_tab', tabName);

        document.querySelectorAll('.hub-tab-btn').forEach(b => {
            b.style.background = '#2b1d0c';
            b.style.color = '#e3d2ab';
        });
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.style.background = '#e3d2ab';
            activeBtn.style.color = '#2b1d0c';
        }

        document.querySelectorAll('.hub-pane').forEach(pane => pane.style.display = 'none');
        const targetPane = document.getElementById(`tab-pane-${tabName}`);
        if (targetPane) targetPane.style.display = 'block';

        if (tabName === 'plan') {
            renderPlanTab(targetPane);
        } else if (tabName === 'incomings' && !incCache.attacks) {
            document.getElementById('hub-scan-btn').click();
        } else if (tabName === 'incomings' && incCache.attacks) {
            const incPane = document.getElementById('tab-pane-incomings');
            if (incCache.selectedAttack && incCache.availableOptions) {
                renderSrezView(incPane, incCache.selectedAttack, incCache.availableOptions);
            } else {
                renderIncomingsList(incPane, incCache.attacks);
            }
        }
    }

    document.querySelectorAll('.hub-tab-btn').forEach(btn => {
        btn.onclick = function() { switchTab(this.getAttribute('data-tab')); };
    });

    function renderPlanTab(container) {
        let freshPlans = localStorage.getItem('tw_hub_planned_orders');
        if (freshPlans) plannedOrders = JSON.parse(freshPlans);
        
        const nowMs = new Date().getTime();
        plannedOrders = plannedOrders.filter(order => (order.sendMs || 0) >= nowMs);
        savePlans();
        plannedOrders.sort((a, b) => (a.sendMs || 0) - (b.sendMs || 0));

        if (plannedOrders.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #555; margin-top: 30px; font-weight: bold; font-size: 12px;">Список запланированных приказов пуст.<br>Добавьте их из «Входящих» или вкладки «Тайм-коры».</div>`;
            return;
        }

        let html = `<p style="font-weight: bold; margin-bottom: 8px; color: #5a2d0c; font-size: 12px;">Запланированные отправки (${plannedOrders.length}):</p>`;
        plannedOrders.forEach((order, idx) => {
            const isOverdue = (order.sendMs || 0) < nowMs;
            const borderColor = isOverdue ? '#b22222' : '#c19a5b';
            const borderWidth = isOverdue ? '2px' : '1px';
            const bgCol = isOverdue ? '#fae6e6' : '#fff';
            const overdueTag = isOverdue ? `<span style="background: #b22222; color: #fff; padding: 2px 4px; border-radius: 2px; font-size: 9px; margin-left: 6px; font-weight: bold;">ПРОСРОЧЕНО</span>` : '';
            const sourceType = order.sourceType || 'Входящие';
            const badgeBg = sourceType === 'Входящие' ? '#336699' : '#8b4513';
            const sourceBadge = `<span style="background: ${badgeBg}; color: #fff; padding: 2px 5px; border-radius: 2px; font-size: 9px; margin-right: 6px; font-weight: bold;">${sourceType}</span>`;

            html += `
                <div style="background: ${bgCol}; border: ${borderWidth} solid ${borderColor}; padding: 8px; margin-bottom: 6px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                    <div>
                        ${sourceBadge}<b>#${idx + 1}</b> | Деревня: <b>${order.origin}</b> → Цель: <b>${order.target}</b> ${overdueTag}<br>
                        <span style="margin-left: 42px;">Войска: <span style="color: #000; font-weight: bold;">${order.unitsSummary}</span> | Отправка: <span style="color: #b22222; font-weight: bold;">${order.sendTime}</span></span>
                    </div>
                    <div>
                        <a href="${order.link}" target="_blank" style="background: #f4e4bc; border: 1px solid #7d510f; padding: 3px 8px; text-decoration: none; color: #333; border-radius: 3px; font-weight: bold; margin-right: 4px; display:inline-block; font-size: 10px;">Перейти</a>
                        <button class="del-plan-btn" data-idx="${idx}" style="background: #a63a3a; color: #fff; border: 1px solid #5a0c0c; padding: 3px 6px; cursor: pointer; border-radius: 3px; font-weight: bold; font-size: 10px;">Удалить</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;

        container.querySelectorAll('.del-plan-btn').forEach(delBtn => {
            delBtn.onclick = function() {
                plannedOrders.splice(this.getAttribute('data-idx'), 1);
                savePlans();
                renderPlanTab(container);
            };
        });
    }

    function getDistance(coord1, coord2) {
        if (!coord1 || !coord2) return 10;
        let match1 = coord1.match(/(\d+)\|(\d+)/);
        let match2 = coord2.match(/(\d+)\|(\d+)/);
        if (!match1 || !match2) return 10;
        return Math.sqrt(Math.pow(match1[1] - match2[1], 2) + Math.pow(match1[2] - match2[2], 2));
    }

    function calculateTravelTimeMs(distance, unitSpeedSec) {
        return Math.round(distance * unitSpeedSec) * 1000;
    }

    function renderTimeCoordsTab(container) {
        container.innerHTML = `
            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <label style="font-weight: bold; font-size: 11px; color: #5a2d0c;">Целевые координаты:</label>
                    <button id="tc-clear-targets-btn" style="background: #a63a3a; color: #fff; border: 1px solid #5a0c0c; padding: 2px 6px; font-size: 9px; font-weight: bold; cursor: pointer; border-radius: 2px;">Очистить</button>
                </div>
                <textarea id="tc-targets-input" placeholder="Вставьте координаты целей (например: 500|400 501|401)" style="width: 100%; height: 42px; font-size: 11px; border: 1px solid #7d510f; padding: 4px; background: #fff; box-sizing: border-box;">${savedTcTargets}</textarea>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-end;">
                <div style="flex: 1; max-width: 280px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <label style="font-weight: bold; font-size: 9px; color: #5a2d0c;">Время прихода:</label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 2px; font-size: 9px; font-weight: bold; color: #5a2d0c;">
                            <input type="checkbox" id="tc-global-lock-chk" style="cursor: pointer; width: 10px; height: 10px; margin: 0;"> Отключить время
                        </label>
                    </div>
                    <input type="text" id="tc-arrival-input" value="${savedTcArrival}" style="width: 100%; font-size: 10px; border: 1px solid #7d510f; padding: 2px 4px; background: #fff; box-sizing: border-box; text-align: center;">
                </div>
                <div style="width: 65px;">
                    <label style="font-weight: bold; font-size: 9px; color: #5a2d0c; display: block; margin-bottom: 2px;">Лимит/цель:</label>
                    <input type="number" id="tc-max-per-target" value="${savedMaxTarget}" min="1" max="10" style="width: 100%; font-size: 10px; border: 1px solid #7d510f; padding: 2px 4px; background: #fff; text-align: center; box-sizing: border-box;">
                </div>
                <div style="width: 65px;">
                    <label style="font-weight: bold; font-size: 9px; color: #5a2d0c; display: block; margin-bottom: 2px;">Лимит/ист:</label>
                    <input type="number" id="tc-max-per-source" value="${savedMaxSource}" min="1" max="10" style="width: 100%; font-size: 10px; border: 1px solid #7d510f; padding: 2px 4px; background: #fff; text-align: center; box-sizing: border-box;">
                </div>
            </div>

            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                <button id="tc-generate-btn" style="background: #c19a5b; border: 1px solid #5a3b0c; color: #2b1d0c; font-weight: bold; padding: 5px 12px; cursor: pointer; border-radius: 3px; flex: 2; font-size: 11px;">Рассчитать тайм-коры</button>
                <button id="tc-refresh-villages-btn" style="background: #a47846; border: 1px solid #4a331a; color: #fff; font-weight: bold; padding: 5px 10px; cursor: pointer; border-radius: 3px; flex: 1.5; font-size: 11px;">🔄 Обновить деревни</button>
                <button id="tc-refresh-btn" style="background: #8fa876; border: 1px solid #3c522b; color: #1a2b0c; font-weight: bold; padding: 5px 10px; cursor: pointer; border-radius: 3px; flex: 1; font-size: 11px;">Сбросить время</button>
            </div>

            <div id="tc-results-area" style="font-size: 11px; color: #333;">
                <p style="text-align: center; color: #555; margin-top: 20px; font-size: 11px;">Введите координаты целей, настройте время и лимиты вверху и нажмите расчет.</p>
            </div>
        `;

        const targetsInput = container.querySelector('#tc-targets-input');
        const arrivalInput = container.querySelector('#tc-arrival-input');
        const maxTargetInput = container.querySelector('#tc-max-per-target');
        const maxSourceInput = container.querySelector('#tc-max-per-source');
        const globalLockChk = container.querySelector('#tc-global-lock-chk');

        targetsInput.oninput = function() { savedTcTargets = this.value; localStorage.setItem('tw_hub_tc_targets', savedTcTargets); };
        arrivalInput.oninput = function() {
            savedTcArrival = this.value;
            localStorage.setItem('tw_hub_tc_arrival', savedTcArrival);
            if (globalLockChk.checked && tcCache.selectedPairs) {
                tcCache.selectedPairs.forEach(pair => {
                    if (!pair.lockTime) pair.indivArrStr = savedTcArrival;
                });
                persistTcState();
                renderTcResultsTable(tcCache.selectedPairs, container.querySelector('#tc-results-area'), parseArrivalTime(savedTcArrival).getTime(), savedTcArrival, container);
            }
        };
        maxTargetInput.oninput = function() { savedMaxTarget = this.value; localStorage.setItem('tw_hub_tc_max_target', savedMaxTarget); };
        maxSourceInput.oninput = function() { savedMaxSource = this.value; localStorage.setItem('tw_hub_tc_max_source', savedMaxSource); };

        container.querySelector('#tc-clear-targets-btn').onclick = function() {
            targetsInput.value = ''; savedTcTargets = ''; localStorage.setItem('tw_hub_tc_targets', '');
            tcCache.selectedPairs = null; persistTcState();
            renderTimeCoordsTab(container);
        };

        const runCalculation = async (isFullRefresh = false, forceReloadVillages = false) => {
            const rawCoords = targetsInput.value.match(/\d{1,3}\|\d{1,3}/g);
            const resultsArea = container.querySelector('#tc-results-area');
            if (!rawCoords || rawCoords.length === 0) {
                resultsArea.innerHTML = `<div style="color: #b22222; font-weight: bold; text-align: center; margin-top: 20px; font-size: 11px;">Не найдены валидные координаты в поле ввода!</div>`;
                return;
            }

            const targets = [...new Set(rawCoords)];
            const arrivalDate = parseArrivalTime(arrivalInput.value);
            const arrivalMs = arrivalDate.getTime();
            tcCache.arrivalDateMs = arrivalMs;

            let oldPairsMap = new Map();
            if (tcCache.selectedPairs) {
                tcCache.selectedPairs.forEach(p => oldPairsMap.set(`${p.vil.coords}_${p.target}_${p.activeUnitIdx}`, p));
            }

            let playerVillages = [];
            if (!forceReloadVillages && tcCache.cachedVillages) {
                playerVillages = tcCache.cachedVillages;
            } else {
                document.getElementById('hub-status').innerText = 'Статус: Загрузка деревень и войск...';
                try {
                    const response = await fetch('/game.php?screen=overview_villages&mode=units');
                    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                    doc.querySelectorAll('tr').forEach((row) => {
                        const rowText = row.innerText.toLowerCase();
                        if (rowText.includes('итого') || rowText.includes('всего') || !rowText.trim()) return;
                        const cols = row.querySelectorAll('td');
                        const link = row.querySelector('a[href*="village="]');
                        const matchCoord = row.innerText.match(/\d+\|\d+/);

                        if (link && matchCoord) {
                            let matchId = link.getAttribute('href').match(/village=(\d+)/);
                            if (matchId) {
                                let cleanUnits = [];
                                cols.forEach(col => {
                                    let text = col.innerText.trim();
                                    if (/^\d+$/.test(text) && text.length < 7) cleanUnits.push(text);
                                });
                                while(cleanUnits.length < UNIT_COUNT) cleanUnits.push('0');
                                if (!playerVillages.some(v => v.id === matchId[1])) {
                                    playerVillages.push({ id: matchId[1], coords: matchCoord[0], units: cleanUnits.slice(0, UNIT_COUNT) });
                                }
                            }
                        }
                    });
                } catch (e) {}

                if (playerVillages.length === 0 && typeof game_data !== 'undefined') {
                    playerVillages.push({ id: game_data.village.id, coords: game_data.village.coord, units: Array(UNIT_COUNT).fill('100') });
                }
                tcCache.cachedVillages = playerVillages;
            }

            let allPairs = [], currentNowMs = new Date().getTime();
            playerVillages.forEach(vil => {
                targets.forEach(target => {
                    if (vil.coords === target) return;
                    const dist = getDistance(vil.coords, target);

                    for (let u = 0; u < UNIT_COUNT; u++) {
                        if (!unitFilterStates[u]) continue;
                        let availableCount = parseInt(vil.units[u] || 0);
                        let minReq = unitMinValues[u] || 0;
                        if (availableCount < (minReq > 0 ? minReq : 1)) continue;

                        let key = `${vil.coords}_${target}_${u}`, existingPair = oldPairsMap.get(key);
                        let targetArrMs = arrivalMs, isLocked = false, indStr = arrivalInput.value;

                        if (existingPair && !isFullRefresh) {
                            isLocked = existingPair.lockTime;
                            if (isLocked && existingPair.indivArrStr) {
                                let parsedDate = parseArrivalTime(existingPair.indivArrStr);
                                if (!isNaN(parsedDate.getTime())) {
                                    targetArrMs = parsedDate.getTime();
                                    indStr = existingPair.indivArrStr;
                                }
                            }
                        }

                        let sendMs = targetArrMs - calculateTravelTimeMs(dist, unitSpeeds[u]);
                        if (sendMs < currentNowMs) continue;

                        let unitsArr = Array(UNIT_COUNT).fill('0');
                        unitsArr[u] = availableCount.toString();

                        let newPair = {
                            vil: vil, target: target, dist: dist, activeUnitIdx: u, maxSpeed: unitSpeeds[u], sendMs: sendMs,
                            currentUnits: unitsArr, sliderVal: 100, sigVal: '0', indivArrStr: indStr, lockTime: isLocked
                        };

                        if (existingPair && !isFullRefresh) {
                            newPair.sliderVal = existingPair.sliderVal;
                            newPair.sigVal = existingPair.sigVal;
                            newPair.currentUnits = [...existingPair.currentUnits];
                        }
                        allPairs.push(newPair);
                    }
                });
            });

            allPairs.sort((a, b) => a.sendMs - b.sendMs);
            let targetCounts = {}, sourceCounts = {}, selectedPairs = [];
            let maxPerTarget = parseInt(maxTargetInput.value) || 1;
            let maxPerSource = parseInt(maxSourceInput.value) || 1;

            allPairs.forEach(pair => {
                let t = pair.target, s = pair.vil.coords;
                targetCounts[t] = targetCounts[t] || 0;
                sourceCounts[s] = sourceCounts[s] || 0;
                if (targetCounts[t] < maxPerTarget && sourceCounts[s] < maxPerSource) {
                    targetCounts[t]++; sourceCounts[s]++;
                    selectedPairs.push(pair);
                }
            });

            tcCache.selectedPairs = selectedPairs;
            persistTcState();
            renderTcResultsTable(selectedPairs, resultsArea, arrivalMs, arrivalInput.value, container);
            document.getElementById('hub-status').innerText = `Статус: Готово (${selectedPairs.length} вариантов)`;
        };

        container.querySelector('#tc-generate-btn').onclick = () => runCalculation(false, false);
        container.querySelector('#tc-refresh-villages-btn').onclick = () => runCalculation(false, true);
        container.querySelector('#tc-refresh-btn').onclick = () => runCalculation(true, false);

        if (tcCache.selectedPairs && tcCache.selectedPairs.length > 0) {
            renderTcResultsTable(tcCache.selectedPairs, container.querySelector('#tc-results-area'), tcCache.arrivalDateMs || new Date().getTime(), savedTcArrival, container);
        }
    }

    function updateRowBorders(row, sendMs) {
        const isOk = sendMs >= new Date().getTime();
        const borderColor = isOk ? '#2e7d32' : '#b22222';
        const bgColor = isOk ? '#e8f5e9' : '#ffebee';
        row.querySelectorAll('.tc-unit-input-val, .unit-input-val').forEach(inp => {
            inp.style.borderColor = borderColor;
            inp.style.borderWidth = '2px';
            inp.style.backgroundColor = bgColor;
        });
    }

    function renderTcResultsTable(selectedPairs, resultsArea, arrivalMs, defaultArrivalStr, mainContainer) {
        selectedPairs = selectedPairs.filter(p => (p.sendMs || 0) >= new Date().getTime());
        tcCache.selectedPairs = selectedPairs;
        persistTcState();

        if (selectedPairs.length === 0) {
            resultsArea.innerHTML = `<div style="padding: 15px; text-align: center; color: #b22222; font-weight: bold; font-size: 11px;">Нет актуальных вариантов отправки.</div>`;
            return;
        }

        let tableRowsHtml = '';
        selectedPairs.forEach((pair, idx) => {
            const vil = pair.vil;
            let formattedTime = formatDateStr(new Date(pair.sendMs));
            let formattedTravelTime = formatDuration(calculateTravelTimeMs(pair.dist, unitSpeeds[pair.activeUnitIdx]));
            let [tX, tY] = pair.target.split('|');

            let unitInputs = '';
            for (let u = 0; u < UNIT_COUNT; u++) {
                let maxVal = parseInt(vil.units[u]) || 0;
                unitInputs += `
                    <td style="padding: 2px; border-right: 1px solid #e2d2b5;">
                        <input type="text" class="tc-unit-input-val" data-max="${maxVal}" data-unit-idx="${u}" value="${pair.currentUnits[u]}" style="width: 24px; font-size: 9px; text-align: center; background: #fff; border: 2px solid #ccc;">
                        <br><span style="font-size: 7px; color: #555;">${maxVal}</span>
                    </td>
                `;
            }

            tableRowsHtml += `
                <tr class="tc-row" data-pair-idx="${idx}" data-send-ms="${pair.sendMs}" style="border-bottom: 1px solid #ddd; background: ${idx % 2 === 0 ? '#fff' : '#fdf8ed'}; text-align: center;">
                    <td style="padding: 6px; font-weight: bold; border-right: 1px solid #e2d2b5; text-align: left; padding-left: 8px;">
                        ${vil.coords} → <span style="color: #5a2d0c;">${pair.target}</span><br>
                        <span style="font-size: 9px; color: #8b4513; font-weight: bold;">Юнит: ${unitNames[pair.activeUnitIdx]}</span>
                        <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                            <input type="range" class="tc-vil-slider" min="0" max="100" value="${pair.sliderVal}" style="width: 55px; height: 10px;">
                            <span style="font-size: 9px; color: #555;" class="tc-slider-val">${pair.sliderVal}%</span>
                        </div>
                    </td>
                    ${unitInputs}
                    <td style="padding: 3px; border-right: 1px solid #e2d2b5;"><input type="text" class="tc-sig-input-val" value="${pair.sigVal}" style="width: 20px; font-size: 10px; text-align: center; border: 1px solid #7d510f; background: #fff;"></td>
                    <td style="padding: 3px; border-right: 1px solid #e2d2b5; font-size: 10px;">
                        <div style="font-size: 8px; color: #555; margin-bottom: 2px; display: flex; align-items: center; justify-content: center; gap: 3px;">
                            <span>Приход:</span>
                            <input type="checkbox" class="tc-lock-time-chk" ${pair.lockTime ? 'checked' : ''} style="cursor: pointer; width: 10px; height: 10px; margin: 0;">
                        </div>
                        <input type="text" class="tc-indiv-arr-input" value="${pair.indivArrStr || defaultArrivalStr}" style="width: 105px; font-size: 9px; text-align: center; border: 1px solid #7d510f; background: #fff;">
                    </td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px;" class="tc-col-arrival">00:00:00</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px;" class="tc-col-time">${formattedTime}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px; color: #333;" class="tc-col-travel-time">${formattedTravelTime}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; color: #b22222; font-weight: bold; font-size: 10px;" class="tc-col-timer">00:00:00</td>
                    <td style="padding: 6px; white-space: nowrap;">
                        <a href="/game.php?village=${vil.id}&screen=place&x=${tX}&y=${tY}&input_x=${tX}&input_y=${tY}&try=confirm&${unitNames[pair.activeUnitIdx].toLowerCase()}=${pair.currentUnits[pair.activeUnitIdx]}" target="_blank" style="background: #f4e4bc; border: 1px solid #7d510f; padding: 3px 6px; text-decoration: none; color: #333; border-radius: 3px; font-weight: bold; display:inline-block; margin-right: 3px; font-size: 10px;">Перейти</a>
                        <button class="tc-plan-single" style="background: #e3d2ab; border: 1px solid #7d510f; padding: 3px 6px; font-weight: bold; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 3px;">План</button>
                        <button class="tc-del-row-btn" style="background: #a63a3a; color: #fff; border: 1px solid #5a0c0c; padding: 3px 6px; font-weight: bold; border-radius: 3px; cursor: pointer; font-size: 10px;">Уд.</button>
                    </td>
                </tr>
            `;
        });

        let headerUnitsHtml = '';
        for (let u = 0; u < UNIT_COUNT; u++) headerUnitsHtml += `<th style="padding: 4px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">${unitNames[u]}</th>`;

        resultsArea.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px; color: #5a2d0c; font-size: 11px;">Найдено вариантов: ${selectedPairs.length}</div>
            <div style="overflow-x: auto; max-height: 280px; border: 1px solid #7d510f;">
                <table style="width: 100%; border-collapse: collapse; background: #fff; font-size: 10px; text-align: center;">
                    <tr style="background: #d4bc8c; border-bottom: 2px solid #7d510f; font-weight: bold; position: sticky; top: 0; z-index: 5;">
                        <th style="padding: 5px; border-right: 1px solid #c19a5b; width: 110px; font-size: 9px;">Источник → Цель</th>
                        ${headerUnitsHtml}
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Сиг</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Время прихода</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Приход (сейчас)</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Время отправки</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">В пути</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Таймер</th>
                        <th style="padding: 5px; font-size: 9px;">Действие</th>
                    </tr>
                    ${tableRowsHtml}
                </table>
            </div>
        `;

        resultsArea.querySelectorAll('.tc-row').forEach(row => updateRowBorders(row, parseInt(row.dataset.sendMs || 0)));

        if (window.tcTimerInterval) clearInterval(window.tcTimerInterval);
        window.tcTimerInterval = setInterval(() => {
            let now = new Date().getTime();
            let globalLock = mainContainer.querySelector('#tc-global-lock-chk')?.checked;

            document.querySelectorAll('.tc-row').forEach(row => {
                let sendMs = parseInt(row.dataset.sendMs || 0);
                let diffSec = Math.round((sendMs - now) / 1000);
                let timerElem = row.querySelector('.tc-col-timer');
                let arrivalNowElem = row.querySelector('.tc-col-arrival');
                let pair = selectedPairs[parseInt(row.getAttribute('data-pair-idx'))];

                if (pair && arrivalNowElem) {
                    arrivalNowElem.innerText = globalLock ? "00:00:00" : formatDateStr(new Date(now + calculateTravelTimeMs(pair.dist, unitSpeeds[pair.activeUnitIdx])));
                }
                if (!timerElem) return;
                updateRowBorders(row, sendMs);

                if (diffSec <= 0) {
                    timerElem.innerText = "00:00:00"; timerElem.style.color = "#008000";
                } else {
                    let h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
                    let m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
                    let s = (diffSec % 60).toString().padStart(2, '0');
                    timerElem.innerText = `${h}:${m}:${s}`; timerElem.style.color = "#b22222";
                }
            });
        }, 1000);

        resultsArea.querySelectorAll('.tc-row').forEach(row => {
            let pIdx = parseInt(row.getAttribute('data-pair-idx')), pair = selectedPairs[pIdx];
            let slider = row.querySelector('.tc-vil-slider'), inputs = row.querySelectorAll('.tc-unit-input-val');
            let sliderValLabel = row.querySelector('.tc-slider-val'), indivInp = row.querySelector('.tc-indiv-arr-input');
            let sigInp = row.querySelector('.tc-sig-input-val'), lockChk = row.querySelector('.tc-lock-time-chk');

            sigInp.oninput = function() { pair.sigVal = this.value; persistTcState(); };
            lockChk.onchange = function() { pair.lockTime = this.checked; persistTcState(); };
            indivInp.oninput = function() { pair.indivArrStr = this.value; pair.lockTime = true; lockChk.checked = true; recalculateTcRow(row, selectedPairs, arrivalMs); };

            slider.oninput = function() {
                let percent = parseInt(this.value);
                pair.sliderVal = percent; sliderValLabel.innerText = percent + '%';
                let activeU = pair.activeUnitIdx, maxVal = parseInt(inputs[activeU].getAttribute('data-max')) || 0;
                let val = Math.round((maxVal * percent) / 100);
                inputs[activeU].value = val; pair.currentUnits[activeU] = val;
                recalculateTcRow(row, selectedPairs, arrivalMs);
            };

            inputs.forEach(inp => { inp.oninput = () => recalculateTcRow(row, selectedPairs, arrivalMs); });
            row.querySelector('.tc-del-row-btn').onclick = function() {
                selectedPairs.splice(pIdx, 1); persistTcState();
                renderTcResultsTable(selectedPairs, resultsArea, arrivalMs, defaultArrivalStr, mainContainer);
            };

            row.querySelector('.tc-plan-single').onclick = function() {
                let unitsSummary = [];
                inputs.forEach(inp => { if (parseInt(inp.value) > 0) unitsSummary.push(inp.value); });
                let fresh = localStorage.getItem('tw_hub_planned_orders');
                if (fresh) plannedOrders = JSON.parse(fresh);

                plannedOrders.push({
                    origin: pair.vil.coords, target: pair.target,
                    sendTime: row.querySelector('.tc-col-time').innerText,
                    unitsSummary: `[${unitsSummary.join('/')}] (${unitNames[pair.activeUnitIdx]})`,
                    link: row.querySelector('a[href*="screen=place"]').getAttribute('href'),
                    sendMs: pair.sendMs, sourceType: 'Тайм-кор'
                });
                savePlans();
                renderPlanTab(document.getElementById('tab-pane-plan'));
                this.style.background = '#2e7d32'; this.style.color = '#fff'; this.innerText = 'Ок';
            };
        });
    }

    function recalculateTcRow(row, selectedPairs, arrivalMs) {
        let pair = selectedPairs[parseInt(row.getAttribute('data-pair-idx'))];
        if (!pair) return;
        let targetArrivalMs = arrivalMs, indivInp = row.querySelector('.tc-indiv-arr-input'), lockChk = row.querySelector('.tc-lock-time-chk');
        if (lockChk.checked) pair.lockTime = true;
        if (pair.lockTime && indivInp && indivInp.value) {
            let parsedDate = parseArrivalTime(indivInp.value);
            if (!isNaN(parsedDate.getTime())) targetArrivalMs = parsedDate.getTime();
            pair.indivArrStr = indivInp.value;
        }
        row.querySelectorAll('.tc-unit-input-val').forEach((inp, u) => { pair.currentUnits[u] = inp.value; });
        let sendTimeMs = targetArrivalMs - calculateTravelTimeMs(pair.dist, unitSpeeds[pair.activeUnitIdx]);
        row.querySelector('.tc-col-time').innerText = formatDateStr(new Date(sendTimeMs));
        row.dataset.sendMs = sendTimeMs; pair.sendMs = sendTimeMs;
        persistTcState(); updateRowBorders(row, sendTimeMs);
    }

    function renderIncomingsList(container, attacks) {
        // Улучшенная фильтрация подкреплений (проверяем тип, alt-атрибуты и изображения)
        let filteredAttacks = attacks.filter(att => {
            if (!hideSupportMode) return true;
            let typeLower = (att.type || '').toLowerCase();
            let isSupport = typeLower.includes('подкр') || 
                            typeLower.includes('support') || 
                            typeLower.includes('подкрепление') || 
                            typeLower.includes('help') ||
                            typeLower.includes('return') ||
                            typeLower.includes('возврат');
            return !isSupport;
        });

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <p style="font-weight: bold; margin: 0; font-size: 11px;">Активные входящие атаки (${filteredAttacks.length} из ${attacks.length}):</p>
                <button id="inc-clear-list-btn" style="background: #a63a3a; color: #fff; border: 1px solid #5a0c0c; padding: 2px 6px; font-size: 9px; font-weight: bold; cursor: pointer; border-radius: 2px;">Очистить список</button>
            </div>
        `;

        if (filteredAttacks.length === 0) {
            html += `<div style="padding: 15px; text-align: center; color: #555; font-size: 11px;">Нет входящих (возможно, все скрыты фильтром подкреплений).</div>`;
            container.innerHTML = html;
        } else {
            filteredAttacks.forEach(att => {
                html += `
                    <div style="background: #fff; border: 1px solid #c19a5b; padding: 8px; margin-bottom: 6px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                        <div>
                            <div style="font-weight: bold; font-size: 11px; color: #5a2d0c; margin-bottom: 3px;">🛡️ #${att.id} | ${att.type} • Цель: ${att.target}</div>
                            <div style="font-size: 10px; color: #666;">Откуда: <b>${att.origin}</b> | Прибытие: <span style="color: #b22222; font-weight: bold;">${att.arrival}</span></div>
                        </div>
                        <div>
                            <button class="open-srez-btn" data-id="${att.id}" style="background: #e3d2ab; border: 1px solid #7d510f; font-weight: bold; font-size: 10px; padding: 4px 8px; cursor: pointer; border-radius: 3px;">Срез / Перехват</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        container.querySelector('#inc-clear-list-btn').onclick = function() {
            incCache.attacks = null; incCache.selectedAttack = null; incCache.availableOptions = null;
            persistIncState();
            container.innerHTML = `<div style="padding: 15px; text-align: center; color: #555; font-size: 11px;">Список входящих очищен. Нажмите «Сканировать».</div>`;
        };

        container.querySelectorAll('.open-srez-btn').forEach(btn => {
            btn.onclick = function() {
                let selectedAttack = attacks.find(a => a.id == this.getAttribute('data-id'));
                if (selectedAttack && typeof selectedAttack.arrivalDate === 'string') selectedAttack.arrivalDate = new Date(selectedAttack.arrivalDate);
                incCache.selectedAttack = selectedAttack;
                generateSrezOptions(selectedAttack);
                renderSrezView(container, selectedAttack, incCache.availableOptions);
            };
        });
    }

    function generateSrezOptions(selectedAttack) {
        let availableOptions = [];
        if (!selectedAttack.arrivalDate || typeof selectedAttack.arrivalDate === 'string') {
            selectedAttack.arrivalDate = new Date(selectedAttack.arrivalDate);
        }
        let arrMs = selectedAttack.arrivalDate.getTime();
        let currentNowMs = new Date().getTime();

        incCache.playerVillages.forEach((vil) => {
            for (let u = 0; u < UNIT_COUNT; u++) {
                if (!unitFilterStates[u]) continue;
                let availableCount = parseInt(vil.units[u] || 0);
                let minReq = unitMinValues[u] || 0;
                if (availableCount < (minReq > 0 ? minReq : 1)) continue;

                let dist = getDistance(vil.coords, selectedAttack.target);
                let initialSendMs = arrMs - calculateTravelTimeMs(dist, unitSpeeds[u]);
                if (initialSendMs < currentNowMs) continue;

                let unitsArr = Array(UNIT_COUNT).fill('0');
                unitsArr[u] = availableCount.toString();
                availableOptions.push({ vil: vil, activeUnitIdx: u, sendMs: initialSendMs, currentUnits: unitsArr, sliderVal: 100, sigVal: '0' });
            }
        });
        availableOptions.sort((a, b) => a.sendMs - b.sendMs);
        incCache.availableOptions = availableOptions;
        persistIncState();
    }

    document.getElementById('hub-scan-btn').onclick = async function() {
        switchTab('incomings');
        const container = document.getElementById('tab-pane-incomings');
        const status = document.getElementById('hub-status');
        status.innerText = 'Статус: Сканирование входящих...';
        
        let attacks = [];
        try {
            const response = await fetch('/game.php?screen=overview_villages&mode=incomings');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const rows = doc.querySelectorAll('#incomings_table tr.nowrap, tr.row_marker');
            
            if (!rows || rows.length === 0) {
                container.innerHTML = `<div style="padding: 15px; text-align: center; color: #b22222; font-weight: bold; font-size: 11px;">Входящие атаки не найдены!</div>`;
                status.innerText = 'Статус: Входящих нет';
                return;
            }

            let nowMs = new Date().getTime();
            rows.forEach((row, index) => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 6) {
                    let typeText = cols[0].innerText.trim();
                    let imgIcon = cols[0].querySelector('img');
                    if (imgIcon && imgIcon.alt) {
                        typeText += ' ' + imgIcon.alt;
                    }
                    let rowHtml = row.innerHTML.toLowerCase();
                    if (rowHtml.includes('support') || rowHtml.includes('command/support') || rowHtml.includes('attack_support')) {
                        typeText += ' подкрепление';
                    }

                    let type = typeText || 'Атака';
                    let targetText = cols[1].innerText.trim();
                    let originElem = cols[2].querySelector('a');
                    let originText = originElem ? originElem.innerText.trim() : cols[2].innerText.trim();
                    let arrival = cols[5].innerText.trim();
                    let arrivalDate = parseArrivalTime(arrival);

                    if (arrivalDate.getTime() > nowMs) {
                        attacks.push({ 
                            id: index + 1, type: type.replace(/\s+/g, ' '), 
                            target: targetText.match(/\d+\|\d+/) ? targetText.match(/\d+\|\d+/)[0] : targetText, 
                            origin: originText.match(/\d+\|\d+/) ? originText.match(/\d+\|\d+/)[0] : '000|000', 
                            arrival, arrivalDate: arrivalDate.toISOString()
                        });
                    }
                }
            });
        } catch (e) {
            container.innerHTML = `<div style="padding: 15px; text-align: center; color: #b22222; font-weight: bold; font-size: 11px;">Ошибка при загрузке входящих.</div>`;
            return;
        }

        status.innerText = 'Статус: Загрузка войск деревень...';
        let playerVillages = [];
        try {
            const response = await fetch('/game.php?screen=overview_villages&mode=units');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            doc.querySelectorAll('tr').forEach((row) => {
                let rowText = row.innerText.toLowerCase();
                if (rowText.includes('итого') || rowText.includes('всего') || !rowText.trim()) return;
                let cols = row.querySelectorAll('td');
                let link = row.querySelector('a[href*="village="]');
                let matchCoord = row.innerText.match(/\d+\|\d+/);

                if (link && matchCoord) {
                    let matchId = link.getAttribute('href').match(/village=(\d+)/);
                    if (matchId) {
                        let cleanUnits = [];
                        cols.forEach(col => {
                            let text = col.innerText.trim();
                            if (/^\d+$/.test(text) && text.length < 7) cleanUnits.push(text);
                        });
                        while(cleanUnits.length < UNIT_COUNT) cleanUnits.push('0');
                        if (!playerVillages.some(v => v.id === matchId[1])) {
                            playerVillages.push({ id: matchId[1], coords: matchCoord[0], units: cleanUnits.slice(0, UNIT_COUNT) });
                        }
                    }
                }
            });
        } catch (e) {}

        if (playerVillages.length === 0 && typeof game_data !== 'undefined') {
            playerVillages.push({ id: game_data.village.id, coords: game_data.village.coord, units: Array(UNIT_COUNT).fill('100') });
        }

        attacks.forEach(a => { a.arrivalDate = new Date(a.arrivalDate); });
        incCache.attacks = attacks; incCache.playerVillages = playerVillages;
        incCache.selectedAttack = null; incCache.availableOptions = null;
        persistIncState();

        status.innerText = `Статус: Атак: ${attacks.length} | Деревень: ${playerVillages.length}`;
        renderIncomingsList(container, attacks);
    };

    function renderSrezView(container, selectedAttack, availableOptions) {
        if (!selectedAttack.arrivalDate || !(selectedAttack.arrivalDate instanceof Date)) {
            selectedAttack.arrivalDate = new Date(selectedAttack.arrivalDate || Date.now());
        }

        availableOptions = availableOptions.filter(opt => (opt.sendMs || 0) >= new Date().getTime());
        incCache.availableOptions = availableOptions;
        persistIncState();

        if (availableOptions.length === 0) {
            container.innerHTML = `
                <div style="margin-bottom: 8px; display: flex; gap: 8px; align-items: center;">
                    <button id="back-to-list" style="background: #d4bc8c; border: 1px solid #7d510f; font-size: 10px; padding: 3px 8px; font-weight: bold; cursor: pointer;">← Назад</button>
                    <button id="refresh-srez-btn" style="background: #c19a5b; border: 1px solid #5a3b0c; color: #2b1d0c; font-size: 10px; padding: 3px 10px; font-weight: bold; cursor: pointer; border-radius: 3px;">🔄 Обновить</button>
                </div>
                <div style="padding: 20px; text-align: center; color: #b22222; font-weight: bold; font-size: 11px;">Нет актуальных вариантов для среза/задефа (все варианты просрочены). Проверьте фильтры юнитов и наличие войск в деревнях.</div>
            `;
            container.querySelector('#back-to-list').onclick = () => {
                incCache.selectedAttack = null; incCache.availableOptions = null; persistIncState();
                renderIncomingsList(container, incCache.attacks);
            };
            container.querySelector('#refresh-srez-btn').onclick = () => {
                generateSrezOptions(selectedAttack);
                renderSrezView(container, selectedAttack, incCache.availableOptions);
            };
            return;
        }

        let [attX, attY] = selectedAttack.target.split('|');
        let tableRowsHtml = '';

        availableOptions.forEach((opt, idx) => {
            const vil = opt.vil;
            let formattedTravelTime = formatDuration(calculateTravelTimeMs(getDistance(vil.coords, selectedAttack.target), unitSpeeds[opt.activeUnitIdx]));

            let unitInputs = '';
            for (let u = 0; u < UNIT_COUNT; u++) {
                let maxVal = parseInt(vil.units[u]) || 0;
                unitInputs += `
                    <td style="padding: 2px; border-right: 1px solid #e2d2b5;">
                        <input type="text" class="unit-input-val" data-max="${maxVal}" data-unit-idx="${u}" value="${opt.currentUnits[u]}" style="width: 24px; font-size: 9px; text-align: center; background: #fff; border: 2px solid #ccc;">
                        <br><span style="font-size: 7px; color: #555;">${maxVal}</span>
                    </td>
                `;
            }

            tableRowsHtml += `
                <tr class="vil-row" data-opt-idx="${idx}" data-send-ms="${opt.sendMs}" style="border-bottom: 1px solid #ddd; background: ${idx % 2 === 0 ? '#fff' : '#fdf8ed'}; text-align: center;">
                    <td style="padding: 6px; font-weight: bold; border-right: 1px solid #e2d2b5; text-align: left; padding-left: 8px;">
                        ${vil.coords}<br>
                        <span style="font-size: 9px; color: #8b4513; font-weight: bold;">Юнит: ${unitNames[opt.activeUnitIdx]}</span>
                        <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                            <input type="range" class="vil-slider" min="0" max="100" value="${opt.sliderVal}" style="width: 55px; height: 10px;">
                            <span style="font-size: 9px; color: #555;" class="slider-val">${opt.sliderVal}%</span>
                        </div>
                    </td>
                    ${unitInputs}
                    <td style="padding: 3px; border-right: 1px solid #e2d2b5;"><input type="text" class="sig-input-val" value="${opt.sigVal}" style="width: 20px; font-size: 10px; text-align: center; border: 1px solid #7d510f; background: #fff;"></td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px;" class="col-time">${formatDateStr(new Date(opt.sendMs))}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px; color: #333;" class="col-travel-time">${formattedTravelTime}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; font-weight: bold; font-size: 10px;" class="col-arrival-time">${formatDateStr(selectedAttack.arrivalDate)}</td>
                    <td style="padding: 6px; border-right: 1px solid #e2d2b5; color: #b22222; font-weight: bold; font-size: 10px;" class="col-timer">00:00:00</td>
                    <td style="padding: 6px; white-space: nowrap;">
                        <a href="/game.php?village=${vil.id}&screen=place&x=${attX}&y=${attY}&input_x=${attX}&input_y=${attY}&try=confirm&${unitNames[opt.activeUnitIdx].toLowerCase()}=${opt.currentUnits[opt.activeUnitIdx]}" target="_blank" style="background: #f4e4bc; border: 1px solid #7d510f; padding: 3px 6px; text-decoration: none; color: #333; border-radius: 3px; font-weight: bold; display:inline-block; margin-right: 3px; font-size: 10px;">Перейти</a>
                        <button class="plan-single-btn" style="background: #e3d2ab; border: 1px solid #7d510f; padding: 3px 6px; font-weight: bold; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 3px;">План</button>
                        <button class="del-row-btn" style="background: #a63a3a; color: #fff; border: 1px solid #5a0c0c; padding: 3px 6px; font-weight: bold; border-radius: 3px; cursor: pointer; font-size: 10px;">Уд.</button>
                    </td>
                </tr>
            `;
        });

        let headerUnitsHtml = '';
        for (let u = 0; u < UNIT_COUNT; u++) headerUnitsHtml += `<th style="padding: 4px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">${unitNames[u]}</th>`;

        container.innerHTML = `
            <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="back-to-list" style="background: #d4bc8c; border: 1px solid #7d510f; font-size: 10px; padding: 3px 8px; font-weight: bold; cursor: pointer;">← Назад</button>
                    <button id="refresh-srez-btn" style="background: #c19a5b; border: 1px solid #5a3b0c; color: #2b1d0c; font-size: 10px; padding: 3px 10px; font-weight: bold; cursor: pointer; border-radius: 3px;">🔄 Обновить</button>
                </div>
                <span style="font-size: 10px; color: #5a2d0c; font-weight: bold;">Вариантов среза: ${availableOptions.length}</span>
            </div>
            <div style="background: #fff; border: 1px solid #7d510f; padding: 6px 10px; margin-bottom: 8px; border-radius: 3px; font-size: 10px;">
                <b>Атака:</b> ${selectedAttack.origin} → ${selectedAttack.target} | <b>Прибытие:</b> <span style="color: #b22222; font-weight: bold;">${selectedAttack.arrival}</span>
            </div>
            <div style="overflow-x: auto; max-height: 280px; border: 1px solid #7d510f;">
                <table style="width: 100%; border-collapse: collapse; background: #fff; font-size: 10px; text-align: center;">
                    <tr style="background: #d4bc8c; border-bottom: 2px solid #7d510f; font-weight: bold; position: sticky; top: 0; z-index: 5;">
                        <th style="padding: 5px; border-right: 1px solid #c19a5b; width: 100px; font-size: 9px;">Деревня / Юнит</th>
                        ${headerUnitsHtml}
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Сиг</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Время отправки</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">В пути</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Прибытие</th>
                        <th style="padding: 5px 2px; border-right: 1px solid #c19a5b; font-size: 8px;">Таймер</th>
                        <th style="padding: 5px; font-size: 9px;">Приказ</th>
                    </tr>
                    ${tableRowsHtml}
                </table>
            </div>
        `;

        container.querySelectorAll('.vil-row').forEach(row => updateRowBorders(row, parseInt(row.dataset.sendMs || 0)));

        container.querySelector('#back-to-list').onclick = () => {
            incCache.selectedAttack = null; incCache.availableOptions = null; persistIncState();
            renderIncomingsList(container, incCache.attacks);
        };
        container.querySelector('#refresh-srez-btn').onclick = () => {
            generateSrezOptions(selectedAttack);
            renderSrezView(container, selectedAttack, incCache.availableOptions);
        };

        if (window.hubTimerInterval) clearInterval(window.hubTimerInterval);
        window.hubTimerInterval = setInterval(() => {
            let now = new Date().getTime();
            container.querySelectorAll('.vil-row').forEach(row => {
                let sendMs = parseInt(row.dataset.sendMs || 0);
                let diffSec = Math.round((sendMs - now) / 1000);
                let timerElem = row.querySelector('.col-timer');
                if (!timerElem) return;
                updateRowBorders(row, sendMs);

                if (diffSec <= 0) {
                    timerElem.innerText = "00:00:00"; timerElem.style.color = "#008000";
                } else {
                    let h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
                    let m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
                    let s = (diffSec % 60).toString().padStart(2, '0');
                    timerElem.innerText = `${h}:${m}:${s}`; timerElem.style.color = "#b22222";
                }
            });
        }, 1000);

        container.querySelectorAll('.vil-row').forEach(row => {
            let optIdx = parseInt(row.getAttribute('data-opt-idx')), opt = availableOptions[optIdx];
            let slider = row.querySelector('.vil-slider'), inputs = row.querySelectorAll('.unit-input-val');
            let sliderValLabel = row.querySelector('.slider-val');

            row.querySelector('.sig-input-val').oninput = function() { opt.sigVal = this.value; persistIncState(); };

            slider.oninput = function() {
                let percent = parseInt(this.value);
                opt.sliderVal = percent; sliderValLabel.innerText = percent + '%';
                let activeU = opt.activeUnitIdx, maxVal = parseInt(inputs[activeU].getAttribute('data-max')) || 0;
                let val = Math.round((maxVal * percent) / 100);
                inputs[activeU].value = val; opt.currentUnits[activeU] = val;
                recalculateRow(row, availableOptions, selectedAttack);
            };

            inputs.forEach(inp => { inp.oninput = () => recalculateRow(row, availableOptions, selectedAttack); });
            row.querySelector('.del-row-btn').onclick = function() {
                availableOptions.splice(optIdx, 1); persistIncState();
                renderSrezView(container, selectedAttack, availableOptions);
            };

            row.querySelector('.plan-single-btn').onclick = function() {
                let unitsSummary = [];
                inputs.forEach(inp => { if (parseInt(inp.value) > 0) unitsSummary.push(inp.value); });
                let fresh = localStorage.getItem('tw_hub_planned_orders');
                if (fresh) plannedOrders = JSON.parse(fresh);

                plannedOrders.push({
                    origin: opt.vil.coords, target: selectedAttack.target,
                    sendTime: row.querySelector('.col-time').innerText,
                    unitsSummary: `[${unitsSummary.join('/')}] (${unitNames[opt.activeUnitIdx]})`,
                    link: row.querySelector('a[href*="screen=place"]').getAttribute('href'),
                    sendMs: opt.sendMs, sourceType: 'Входящие'
                });
                savePlans();
                renderPlanTab(document.getElementById('tab-pane-plan'));
                this.style.background = '#2e7d32'; this.style.color = '#fff'; this.innerText = 'Ок';
            };
        });
    }

    function recalculateRow(row, availableOptions, selectedAttack) {
        let opt = availableOptions[parseInt(row.getAttribute('data-opt-idx'))];
        if (!opt) return;
        row.querySelectorAll('.unit-input-val').forEach((inp, u) => { opt.currentUnits[u] = inp.value; });
        let sendTimeMs = selectedAttack.arrivalDate.getTime() - calculateTravelTimeMs(getDistance(opt.vil.coords, selectedAttack.target), unitSpeeds[opt.activeUnitIdx]);
        row.querySelector('.col-time').innerText = formatDateStr(new Date(sendTimeMs));
        row.dataset.sendMs = sendTimeMs; opt.sendMs = sendTimeMs;
        persistIncState(); updateRowBorders(row, sendTimeMs);
    }

    initStaticPanes();
    switchTab(currentActiveTab, false);
})();
