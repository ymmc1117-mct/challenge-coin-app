const CONFIG = {
    MAX_ACCOUNTS: 3,
    STORAGE_KEY: 'challengeCoinData',
    DEFAULT_CHALLENGE: { name: 'お手伝い', value: 10, coins: 0, totalCoins: 0 },
    CELEBRATION_DURATION: 3000,
    CONFETTI_COUNT: 140,
    CONFETTI_COLORS: ['#ff6b9d', '#ffb3ba', '#a8e6cf', '#dae7f8'],
    DEFAULT_ACCOUNT_COLOR: '#e0ffff' // シアン（水色）
};

const StorageAdapter = {
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('保存エラー:', e);
        }
    },
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('読み込みエラー:', e);
            return null;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('削除エラー:', e);
        }
    }
};

const state = {
    appData: { accounts: [] },
    currentAccountIndex: -1,
    currentChallengeIndex: 0,
    confirmCallback: null,
    selectedMonth: 'all'
};

const Utils = {
    $(id) {
        return document.getElementById(id);
    },

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
        }).replace(/\//g, '月') // 月に置換
        .replace(/:/g, '時') // 時:分 のコロンを 時に置換（分が削除されると :00 になるため）
        .replace(/ /g, '日 ')
    },

    validateChallengeValue(value) {
        return (typeof value === 'number' && value >= 1) ? value : 10;
    },

    sanitizeAccountName(name, fallback) {
        return (name && name.trim()) || fallback;
    },

    getBorderColorForAccount(accountColor) {
        const colorMap = {
            '#ffeaff': '#ffdbff', // パステルピンクの境界線（古い色用）
            '#ffeaf4': '#ffd1e8', // パステルピンクの境界線（新しい色用）
            '#ffffd6': '#FFF5BA', // パステルイエローの境界線
            '#e0ffef': '#ccffe5', // パステルミントグリーンの境界線（古い色用）
            '#eafff4': '#eaf7f2', // パステルミントグリーンの境界線（新しい色用）
            '#e0efff': '#d6eaff', // パステルブルーの境界線
            '#f2e5ff': '#eddbff', // パステルラベンダーの境界線
            '#ffefe0': '#ffe8d1', // パステルオレンジの境界線
            '#e0ffff': '#d1ffff'  // デフォルトのシアン（水色）の境界線
        };
        return colorMap[accountColor] || '#cceffa'; // デフォルトは元の色
    }
};

const DataManager = {
    save() {
        StorageAdapter.save(CONFIG.STORAGE_KEY, state.appData);
    },

    load() {
        const saved = StorageAdapter.load(CONFIG.STORAGE_KEY);
        if (saved && Array.isArray(saved.accounts)) {
            this.migrateData(saved);
            state.appData = saved;
            return;
        }

        this.createDefaultData();
    },

    migrateData(data) {
        data.accounts.forEach(acc => {
            if (!acc.challenges) acc.challenges = [];
            if (!acc.history) acc.history = [];
            if (!acc.color) acc.color = CONFIG.DEFAULT_ACCOUNT_COLOR;
           
            if (typeof acc.coins === 'number') {
                if (acc.challenges.length === 0) {
                    acc.challenges.push({ ...CONFIG.DEFAULT_CHALLENGE });
                }
                if (acc.challenges.length > 0) {
                    acc.challenges[0].coins = acc.coins;
                }
                delete acc.coins;
            }
           
            acc.challenges.forEach(chal => {
                if (typeof chal.coins !== 'number') chal.coins = 0;
                if (typeof chal.totalCoins !== 'number') chal.totalCoins = 0;
                chal.value = Utils.validateChallengeValue(chal.value);
            });
        });
    },

    createDefaultData() {
        state.appData = {
            accounts: []
        };
        this.save();
    },

    reset() {
        StorageAdapter.remove(CONFIG.STORAGE_KEY);
        this.load();
    }
};

const AccountManager = {
    getCurrentAccount() {
        return state.appData.accounts[state.currentAccountIndex];
    },

    getCurrentChallenge() {
        const account = this.getCurrentAccount();
        return account?.challenges[state.currentChallengeIndex];
    },

    getTotalCoins(account) {
        return account.challenges.reduce((sum, chal) => sum + chal.coins, 0);
    },

    getTotalReward(account) {
        return account.history.reduce((sum, item) => sum + item.reward, 0);
    },

    addAccount() {
        if (state.appData.accounts.length < CONFIG.MAX_ACCOUNTS) {
            state.appData.accounts.push({
                name: `アカウント ${state.appData.accounts.length + 1}`,
                color: CONFIG.DEFAULT_ACCOUNT_COLOR,
                challenges: [],
                history: []
            });
            DataManager.save();
            return true;
        }
        return false;
    },

    deleteAccount(index) {
        state.appData.accounts.splice(index, 1);
        DataManager.save();
        if (state.currentAccountIndex === index) {
            state.currentAccountIndex = -1;
        }
    },

    addChallenge(account) {
        account.challenges.push({
            name: 'チャレンジ',
            value: 10,
            coins: 0,
            totalCoins: 0
        });
    },

    deleteChallenge(account, index) {
        account.challenges.splice(index, 1);
        if (state.currentChallengeIndex >= account.challenges.length) {
            state.currentChallengeIndex = Math.max(0, account.challenges.length - 1);
        }
    },

    resetAccount(account) {
        account.challenges.forEach(chal => {
            chal.coins = 0;
            chal.totalCoins = 0;
        });
        account.history = [];
        DataManager.save();
    }
};

const CoinManager = {
    addCoin() {
        const challenge = AccountManager.getCurrentChallenge();
        if (!challenge) return;

        challenge.coins += 1;
        challenge.totalCoins += 1;
        DataManager.save();
        UIManager.renderCoinDisplay();
       
        CelebrationManager.show('頑張ったね!', '+1 コイン');
    },

    removeCoin() {
        const challenge = AccountManager.getCurrentChallenge();
        if (!challenge || challenge.coins <= 0) return;

        challenge.coins -= 1;
        challenge.totalCoins -= 1;
        DataManager.save();
        UIManager.renderCoinDisplay();
    },

    exchange(amount) {
        const account = AccountManager.getCurrentAccount();
        const challenge = AccountManager.getCurrentChallenge();
       
        if (!challenge || amount <= 0 || amount > challenge.coins) return;

        const reward = amount * challenge.value;
        challenge.coins -= amount;
       
        account.history.push({
            type: 'exchange',
            coins: amount,
            reward: reward,
            challengeName: challenge.name,
            timestamp: Date.now()
        });

        DataManager.save();
        UIManager.renderDetailScreen();
       
        CelebrationManager.show(
            'おめでとう!',
            `${amount}コインを ${reward.toLocaleString()}円 に交換しました!`
        );
    }
};

const UIManager = {
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        Utils.$(screenId).classList.add('active');

        const isDetail = screenId === 'accountDetailScreen';
        Utils.$('backBtn').style.display = isDetail ? 'flex' : 'none';
        Utils.$('globalSettingsBtn').style.display = !isDetail ? 'flex' : 'none';
        Utils.$('detailSettingsBtn').style.display = isDetail ? 'flex' : 'none';
        Utils.$('challengeButtonsContainer').style.display = isDetail ? 'flex' : 'none';

        if (isDetail) {
            this.renderDetailScreen();
            this.setupScrollHandler();
        } else {
            Utils.$('headerTitle').textContent = 'Challenge Coin!';
            this.renderAccountSelectScreen();
            this.removeScrollHandler();
        }
    },

    setupScrollHandler() {
        const screen = Utils.$('accountDetailScreen');
        const buttonsContainer = Utils.$('challengeButtonsContainer');
       
        if (screen && buttonsContainer) {
            screen.addEventListener('scroll', this.handleScroll);
        }
    },

    removeScrollHandler() {
        const screen = Utils.$('accountDetailScreen');
        if (screen) {
            screen.removeEventListener('scroll', this.handleScroll);
        }
    },

    handleScroll() {
        const screen = Utils.$('accountDetailScreen');
        const buttonsContainer = Utils.$('challengeButtonsContainer');
       
        if (screen && buttonsContainer) {
            if (screen.scrollTop > 10) {
                buttonsContainer.classList.add('floating');
            } else {
                buttonsContainer.classList.remove('floating');
            }
        }
    },

    renderAccountSelectScreen() {
        const list = Utils.$('accountList');
        list.innerHTML = '';
       
        if (state.appData.accounts.length === 0) {
            list.innerHTML = `<div class="account-list-empty">
                アカウントを追加してください<br>
                右上の設定ボタンから登録できます
            </div>`;
            return;
        }

        state.appData.accounts.forEach((account, index) => {
            const card = this.createAccountCard(account, index);
            list.appendChild(card);
        });
    },

    createAccountCard(account, index) {
        const card = document.createElement('div');
        card.classList.add('account-card');
        card.dataset.index = index;
        card.style.backgroundColor = account.color || CONFIG.DEFAULT_ACCOUNT_COLOR;
        card.style.borderColor = Utils.getBorderColorForAccount(account.color);
       
        const currentCoins = AccountManager.getTotalCoins(account);
        
        // 未交換チャレンジの計算
        const unexchangedChallenges = account.challenges.filter(c => c.coins > 0);
        const unexchangedTotal = unexchangedChallenges.reduce((sum, c) => sum + (c.coins * c.value), 0);
        
        let unexchangedHTML = '';
        if (unexchangedChallenges.length > 0) {
            unexchangedHTML = `
                <div class="account-unexchanged">
                    <div class="unexchanged-info">
                        <span class="unexchanged-count">未交換チャレンジ ${unexchangedChallenges.length}件</span>
                        <span class="unexchanged-total">合計 ${unexchangedTotal.toLocaleString()}円</span>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="account-card-main">
                <h3>${account.name}</h3>
                <div class="coins-info">
                    <span class="coins-number-list">${currentCoins}</span>
                    <span>コイン</span>
                </div>
            </div>
            ${unexchangedHTML}
        `;
       
        card.addEventListener('click', () => {
            state.currentAccountIndex = index;
            state.currentChallengeIndex = 0;
            this.showScreen('accountDetailScreen');
        });
       
        return card;
    },

    renderDetailScreen() {
        if (state.currentAccountIndex < 0 ||
            state.currentAccountIndex >= state.appData.accounts.length) {
            this.showScreen('accountSelectScreen');
            return;
        }

        const account = AccountManager.getCurrentAccount();
        Utils.$('headerTitle').textContent = account.name;

        this.renderChallengeButtons(account);
        this.renderCoinDisplay();
        this.renderHistoryCompact();
    },

    renderChallengeButtons(account) {
        const wrapper = Utils.$('challengeButtonsWrapper');
        const container = Utils.$('challengeButtonsContainer');
        wrapper.innerHTML = '';
       
        if (account.challenges.length === 0) {
            container.style.display = 'none';
            state.currentChallengeIndex = -1;
            return;
        }

        container.style.display = 'flex';
        if (state.currentChallengeIndex < 0 || state.currentChallengeIndex >= account.challenges.length) {
            state.currentChallengeIndex = 0;
        }

        account.challenges.forEach((chal, index) => {
            const btn = document.createElement('button');
            btn.classList.add('challenge-button');
            if (index === state.currentChallengeIndex) {
                btn.classList.add('active');
            }
            
            // 未交換コインがある場合はバッジを表示
            if (chal.coins > 0) {
                btn.classList.add('has-unexchanged');
                btn.innerHTML = `<span class="unexchanged-badge">●</span>${chal.name}`;
            } else {
                btn.textContent = chal.name;
            }
            
            btn.addEventListener('click', () => {
                state.currentChallengeIndex = index;
                this.renderDetailScreen();
            });
            wrapper.appendChild(btn);
        });

        if (!wrapper.dataset.scrollListenerAdded) {
            wrapper.addEventListener('scroll', () => {
                if (wrapper.scrollLeft > 0) {
                    container.classList.add('scrolled');
                } else {
                    container.classList.remove('scrolled');
                }
            });
            wrapper.dataset.scrollListenerAdded = 'true';
        }
    },

    renderCoinDisplay() {
        const account = AccountManager.getCurrentAccount();
        const challenge = AccountManager.getCurrentChallenge();
       
        if (state.currentChallengeIndex < 0 || !challenge) {
            this.renderEmptyCoinDisplay();
            return;
        }
       
        this.renderActiveCoinDisplay(challenge, account);
    },

    renderEmptyCoinDisplay() {
        const display = Utils.$('coinsDisplay');
        display.classList.add('empty-state');
        display.classList.add('no-challenges');
        const input = Utils.$('exchangeInput');
        input.value = '';
        input.disabled = true;
        Utils.$('exchangeBtn').disabled = true;
    },

    renderActiveCoinDisplay(challenge, account) {
        const display = Utils.$('coinsDisplay');
        display.classList.remove('empty-state');
        display.classList.remove('no-challenges');
       
        Utils.$('currentCoins').classList.remove('disabled');
        Utils.$('removeCoinBtn').disabled = challenge.coins <= 0;
        Utils.$('addCoinBtn').disabled = false;

        Utils.$('currentCoins').textContent = challenge.coins;
        Utils.$('currentValue').textContent = challenge.coins * challenge.value;
        Utils.$('coinValueLabel').innerHTML =
            `${challenge.name}　1コイン = <strong>${challenge.value}</strong>円`;
       
        const totalCoins = account.challenges.reduce((sum, c) => sum + c.totalCoins, 0);
        Utils.$('totalCoins').textContent = totalCoins;

        const input = Utils.$('exchangeInput');
        input.disabled = false;
        input.min = 1;
        input.max = challenge.coins;

        // 初期値を設定しない（空のまま）

        this.updateExchangeButton(challenge);
    },

    updateExchangeButton(challenge) {
        const input = Utils.$('exchangeInput');
        const btn = Utils.$('exchangeBtn');

        if (challenge.coins === 0) {
            input.value = '';
            input.placeholder = 'コインがありません';
            input.disabled = true;
            btn.disabled = true;
            return;
        }

        const amount = parseInt(input.value);

        input.min = 1;
        input.max = challenge.coins;
        input.disabled = false;
        input.placeholder = 'コイン枚数を入力';

        // ボタンは常に活性化された状態にするが、機能的には入力値の検証を行う
        btn.disabled = false; // 常に活性化された見た目にする
        // 実際の交換処理では入力値の検証を行うので、ここでは視覚的に活性化だけする
    },

    renderHistoryCompact() {
        const account = AccountManager.getCurrentAccount();
        const totalReward = AccountManager.getTotalReward(account);
        Utils.$('totalReward').textContent = `${totalReward.toLocaleString()}円`;
       
        const list = Utils.$('historyList');
        const preview = Utils.$('historyPreview');
        list.innerHTML = '';
        preview.innerHTML = '';

        if (account.history.length === 0) {
            list.innerHTML = '<div class="history-empty">まだ履歴はありません</div>';
            preview.classList.add('hidden');
            return;
        }

        // プレビューは常に非表示
        preview.classList.add('hidden');

        // 月選択ドロップダウンを更新
        this.updateMonthFilter(account);

        // フィルター適用して表示
        this.filterAndDisplayHistory(account);
    },

    updateMonthFilter(account) {
        const container = Utils.$('monthFilterOptions');
        const currentValue = state.selectedMonth || 'all';
        
        // 履歴から月のリストを取得
        const months = new Set();
        account.history.forEach(item => {
            const date = new Date(item.timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
        });

        // ドロップダウンを更新
        const sortedMonths = Array.from(months).sort().reverse();
        container.innerHTML = '';
        
        // 「すべて」オプション
        const allOption = document.createElement('div');
        allOption.classList.add('custom-select-option');
        allOption.dataset.value = 'all';
        allOption.textContent = 'すべて';
        if (currentValue === 'all') {
            allOption.classList.add('selected');
            Utils.$('monthFilterValue').textContent = 'すべて';
        }
        allOption.addEventListener('click', () => this.selectMonth('all', 'すべて'));
        container.appendChild(allOption);
        
        // 月別オプション
        sortedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-');
            const option = document.createElement('div');
            option.classList.add('custom-select-option');
            option.dataset.value = monthKey;
            option.textContent = `${year}年${parseInt(month)}月`;
            if (currentValue === monthKey) {
                option.classList.add('selected');
                Utils.$('monthFilterValue').textContent = `${year}年${parseInt(month)}月`;
            }
            option.addEventListener('click', () => this.selectMonth(monthKey, `${year}年${parseInt(month)}月`));
            container.appendChild(option);
        });
    },

    selectMonth(value, text) {
        state.selectedMonth = value;
        Utils.$('monthFilterValue').textContent = text;
        Utils.$('monthFilterContainer').classList.remove('open');
        
        // 選択状態を更新
        document.querySelectorAll('.custom-select-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.value === value) {
                opt.classList.add('selected');
            }
        });
        
        const account = AccountManager.getCurrentAccount();
        if (account) {
            this.filterAndDisplayHistory(account);
        }
    },

    filterAndDisplayHistory(account) {
        const selectedMonth = state.selectedMonth || 'all';
        const list = Utils.$('historyList');
        
        let filteredHistory = account.history.slice().reverse();
        
        if (selectedMonth !== 'all') {
            filteredHistory = filteredHistory.filter(item => {
                const date = new Date(item.timestamp);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === selectedMonth;
            });
        }

        list.innerHTML = '';
        if (filteredHistory.length === 0) {
            list.innerHTML = '<div class="history-empty">この期間の履歴はありません</div>';
        } else {
            filteredHistory.forEach(item => {
                list.appendChild(this.createHistoryItem(item));
            });
        }
    },

    createHistoryItem(item) {
        const div = document.createElement('div');
        div.classList.add('history-item');
       
        const date = Utils.formatDate(item.timestamp);
        let description = '';
        let amountText = '';
        let badge = '';
       
        if (item.type === 'exchange') {
            description = `${item.coins}コインを交換`;
            amountText = `+${item.reward.toLocaleString()}円`;
            const challengeName = item.challengeName || 'チャレンジ';
            badge = `<span class="history-challenge-badge">${challengeName}</span>`;
        } else if (item.type === 'reset') {
            description = `データリセット (${item.coins}コイン, ${item.reward}円をリセット)`;
            amountText = '—';
        }

        div.innerHTML = `
            <div>
                <div class="history-description">
                    <span>${description}</span>
                    ${badge}
                </div>
                <div class="history-date">${date}</div>
            </div>
            <div class="history-reward-amount">${amountText}</div>
        `;
       
        return div;
    }
};

const ModalManager = {
    show(modalId) {
        const modal = Utils.$(modalId);
        modal.classList.add('show');
    },

    hide(modalId) {
        Utils.$(modalId).classList.remove('show');
    },

    confirm(title, message, callback, confirmText = 'OK', confirmClass = 'btn-confirm-action') {
        Utils.$('confirmTitle').textContent = title;
        Utils.$('confirmMessage').textContent = message;
        Utils.$('confirmActionBtn').textContent = confirmText;
        Utils.$('confirmActionBtn').className = `btn-confirm ${confirmClass}`;
        state.confirmCallback = callback;
        this.show('confirmModal');
    },

    openGlobalSettings() {
        SettingsManager.renderGlobalSettings();
        this.hide('detailSettingsModal');
        this.show('globalSettingsModal');
    },

    openDetailSettings() {
        SettingsManager.renderDetailSettings();
        this.hide('globalSettingsModal');
        this.show('detailSettingsModal');
    }
};

const SettingsManager = {
    renderGlobalSettings() {
        const container = Utils.$('accountSettings');
        container.innerHTML = '';

        state.appData.accounts.forEach((account, index) => {
            const item = this.createAccountSettingItem(account, index);
            container.appendChild(item);
        });

        const addBtn = Utils.$('addAccountBtn');
        if (state.appData.accounts.length >= CONFIG.MAX_ACCOUNTS) {
            addBtn.classList.add('hidden');
        } else {
            addBtn.classList.remove('hidden');
        }
    },

    createAccountSettingItem(account, index) {
        const div = document.createElement('div');
        div.classList.add('account-item');
        div.innerHTML = `
            <input type="text" value="${account.name}"
                   data-index="${index}" class="account-name-input">
            <button class="btn-delete-account" data-index="${index}">
                <svg viewBox="0 0 24 24">
                    <path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z" />
                </svg>
            </button>
        `;
       
        const deleteBtn = div.querySelector('.btn-delete-account');
        deleteBtn.onclick = () => this.handleDeleteAccount(index);
       
        return div;
    },

    handleDeleteAccount(index) {
        const account = state.appData.accounts[index];
        ModalManager.confirm(
            'アカウントの削除',
            `${account.name} を削除してもよろしいですか?`,
            () => {
                AccountManager.deleteAccount(index);
                this.renderGlobalSettings();
                UIManager.showScreen('accountSelectScreen');
                ModalManager.hide('confirmModal');
            },
            '削除する',
            'btn-confirm-action'
        );
    },

    saveGlobalSettings() {
        this.saveAccountNames();
        DataManager.save();
        ModalManager.hide('globalSettingsModal');
        UIManager.showScreen('accountSelectScreen');
    },

    saveAccountNames() {
        document.querySelectorAll('.account-name-input').forEach(input => {
            const index = parseInt(input.dataset.index);
            const account = state.appData.accounts[index];
            if (account) {
                account.name = Utils.sanitizeAccountName(
                    input.value,
                    `アカウント ${index + 1}`
                );
            }
        });
    },

    renderDetailSettings() {
        const account = AccountManager.getCurrentAccount();
        if (!account) return;

        Utils.$('detailModalTitle').textContent = `${account.name} の設定`;
        Utils.$('detailAccountNameInput').value = account.name;

        this.renderColorPicker(account);

        const container = Utils.$('detailChallengeSettings');
        container.innerHTML = '';

        account.challenges.forEach((challenge, index) => {
            const item = this.createChallengeSettingItem(challenge, index);
            container.appendChild(item);
        });
    },

    renderColorPicker(account) {
        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.color === account.color) {
                option.classList.add('selected');
            }
        });
    },

    createChallengeSettingItem(challenge, index) {
        const div = document.createElement('div');
        div.classList.add('challenge-item');
        div.dataset.index = index;

        div.innerHTML = `
            <div class="challenge-header">
                <h4>チャレンジ ${index + 1}</h4>
                <button class="btn-delete-challenge" data-index="${index}">
                    <svg viewBox="0 0 24 24">
                        <path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z" />
                    </svg>
                </button>
            </div>
            <div class="challenge-inputs-group">
                <label for="chal-name-${index}">チャレンジ名</label>
                <input type="text" id="chal-name-${index}"
                       value="${challenge.name}"
                       data-index="${index}"
                       class="challenge-name-input">
            </div>
            <div class="challenge-inputs-group">
                <label for="chal-value-${index}">1コインあたりのおこづかい</label>
               <div class="challenge-value-wrapper">
    <input type="number" id="chal-value-${index}"
           value="${challenge.value}"
           min="1"
           data-index="${index}"
           class="challenge-value-input">
    <span class="value-suffix">円</span>
</div>
                </div>
            </div>
        `;

        const deleteBtn = div.querySelector('.btn-delete-challenge');
        deleteBtn.onclick = () => this.handleDeleteChallenge(index);

        return div;
    },

    handleDeleteChallenge(index) {
        const account = AccountManager.getCurrentAccount();
        const challenge = account.challenges[index];
       
        ModalManager.confirm(
            'チャレンジの削除',
            `チャレンジ「${challenge.name}」を削除してもよろしいですか?`,
            () => {
                AccountManager.deleteChallenge(account, index);
                DataManager.save();
                this.renderDetailSettings();
                UIManager.renderDetailScreen();
                ModalManager.hide('confirmModal');
            },
            '削除する',
            'btn-confirm-action'
        );
    },

    saveDetailSettings() {
        const account = AccountManager.getCurrentAccount();
        if (!account) return;

        account.name = Utils.sanitizeAccountName(
            Utils.$('detailAccountNameInput').value,
            account.name
        );

        this.saveColor(account);
        this.saveChallengeSettings(account);
        DataManager.save();
        ModalManager.hide('detailSettingsModal');
        UIManager.renderDetailScreen();
    },

    saveColor(account) {
        const selectedColor = document.querySelector('.color-option.selected');
        if (selectedColor) {
            account.color = selectedColor.dataset.color;
        }
    },

    saveChallengeSettings(account) {
        document.querySelectorAll('.challenge-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const challenge = account.challenges[index];
           
            if (challenge) {
                const nameInput = item.querySelector('.challenge-name-input');
                const valueInput = item.querySelector('.challenge-value-input');
               
                challenge.name = Utils.sanitizeAccountName(
                    nameInput.value,
                    `チャレンジ ${index + 1}`
                );
                challenge.value = Utils.validateChallengeValue(
                    parseInt(valueInput.value)
                );
            }
        });
    },

    saveInputsBeforeAdd() {
        const account = AccountManager.getCurrentAccount();
        if (!account) return;

        const nameInput = Utils.$('detailAccountNameInput');
        if (nameInput && nameInput.value.trim()) {
            account.name = nameInput.value.trim();
        }

        this.saveChallengeSettings(account);
    }
};

const CelebrationManager = {
    show(title, text) {
        Utils.$('celebration').querySelector('h2').textContent = title;
        Utils.$('celebrationText').innerHTML = text;
        Utils.$('celebration').classList.add('show');
        this.createConfetti();

        setTimeout(() => {
            Utils.$('celebration').classList.remove('show');
            if (state.currentAccountIndex !== -1) {
                const account = AccountManager.getCurrentAccount();
                if (account) {
                    Utils.$('headerTitle').textContent = account.name;
                }
            }
        }, CONFIG.CELEBRATION_DURATION);
    },

    createConfetti() {
        for (let i = 0; i < CONFIG.CONFETTI_COUNT; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.backgroundColor =
                CONFIG.CONFETTI_COLORS[Math.floor(Math.random() * CONFIG.CONFETTI_COLORS.length)];
            confetti.style.left = `${Math.random() * 105}vw`;
            confetti.style.top = `-20vh`;
            confetti.style.animation =
                `confetti-fall 3s ease-out forwards ${Math.random() * 2}s`;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }
    }
};

const EventHandlers = {
    init() {
        Utils.$('globalSettingsBtn').addEventListener('click',
            () => ModalManager.openGlobalSettings());
        Utils.$('detailSettingsBtn').addEventListener('click',
            () => ModalManager.openDetailSettings());
        Utils.$('backBtn').addEventListener('click',
            () => UIManager.showScreen('accountSelectScreen'));

        Utils.$('closeGlobalSettingsBtn').addEventListener('click',
            () => ModalManager.hide('globalSettingsModal'));
        Utils.$('saveGlobalSettingsBtn').addEventListener('click',
            () => SettingsManager.saveGlobalSettings());

        Utils.$('addAccountBtn').addEventListener('click', () => {
            SettingsManager.saveAccountNames();
            if (AccountManager.addAccount()) {
                SettingsManager.renderGlobalSettings();
            }
        });

        Utils.$('closeDetailSettingsBtn').addEventListener('click',
            () => ModalManager.hide('detailSettingsModal'));
        Utils.$('addChallengeInDetailModalBtn').addEventListener('click', () => {
            SettingsManager.saveInputsBeforeAdd();
            const account = AccountManager.getCurrentAccount();
            if (account) {
                AccountManager.addChallenge(account);
                SettingsManager.renderDetailSettings();
            }
        });
        Utils.$('saveDetailSettingsBtn').addEventListener('click',
            () => SettingsManager.saveDetailSettings());

        Utils.$('addCoinBtn').addEventListener('click',
            () => CoinManager.addCoin());
        Utils.$('removeCoinBtn').addEventListener('click',
            () => CoinManager.removeCoin());

        Utils.$('exchangeInput').addEventListener('input',
            () => UIManager.renderCoinDisplay());
        Utils.$('exchangeBtn').addEventListener('click',
            () => this.handleExchange());

        Utils.$('toggleHistoryBtn').addEventListener('click', () => {
            const details = Utils.$('historyDetails');
            const preview = Utils.$('historyPreview');
            const text = Utils.$('historyToggleText');
            const isShowing = details.classList.toggle('show');
            text.textContent = isShowing ? '閉じる' : 'くわしく見る';
            if (isShowing) {
                preview.classList.add('hidden');
            } else {
                preview.classList.remove('hidden');
            }
        });

        // カスタムドロップダウンのトグル
        Utils.$('monthFilterTrigger').addEventListener('click', () => {
            Utils.$('monthFilterContainer').classList.toggle('open');
        });

        // カラーピッカーのイベントリスナー
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
            });
        });

        Utils.$('resetAllBtn').addEventListener('click',
            () => this.handleResetAll());
        Utils.$('resetCurrentBtn').addEventListener('click',
            () => this.handleResetCurrent());

        Utils.$('cancelBtn').addEventListener('click',
            () => ModalManager.hide('confirmModal'));
        Utils.$('confirmActionBtn').addEventListener('click', () => {
            if (state.confirmCallback) {
                state.confirmCallback();
                state.confirmCallback = null;
            }
        });
    },

    handleExchange() {
        const amount = parseInt(Utils.$('exchangeInput').value);
        const challenge = AccountManager.getCurrentChallenge();

        // 入力値が空または無効な場合は交換処理を実行しない
        if (!amount || isNaN(amount) || amount < 1 || amount > challenge.coins) {
            alert('交換できるコイン数が正しくありません。');
            return;
        }

        if (challenge) {
            const reward = amount * challenge.value;
            ModalManager.confirm(
                '交換の確認',
                `${amount}コインを${reward.toLocaleString()}円と交換しますか?`,
                () => {
                    CoinManager.exchange(amount);
                    ModalManager.hide('confirmModal');
                },
                '交換する',
                'exchange-confirm'
            );
        }
    },

    handleResetAll() {
        ModalManager.confirm(
            '全データリセット',
            '全てのアカウントデータと設定を完全に削除します。よろしいですか?',
            () => {
                DataManager.reset();
                state.currentAccountIndex = -1;
                ModalManager.hide('globalSettingsModal');
                ModalManager.hide('confirmModal');
                UIManager.showScreen('accountSelectScreen');
            },
            '全リセット',
            'btn-confirm-action'
        );
    },

    handleResetCurrent() {
        const account = AccountManager.getCurrentAccount();
        if (!account) return;
       
        const totalCoins = AccountManager.getTotalCoins(account);
        const totalReward = AccountManager.getTotalReward(account);

        ModalManager.confirm(
            'アカウントリセット',
            `${account.name}のコイン (${totalCoins}枚) と 履歴 (${totalReward}円分) をリセットします。よろしいですか?`,
            () => {
                AccountManager.resetAccount(account);
                ModalManager.hide('detailSettingsModal');
                ModalManager.hide('confirmModal');
                UIManager.renderDetailScreen();
            },
            'リセットする',
            'btn-confirm-action'
        );
    }
};

function initApp() {
    DataManager.load();

    if (state.appData.accounts.length > 0) {
        state.currentAccountIndex = 0;
        state.currentChallengeIndex = 0;
    } else {
        state.currentAccountIndex = -1;
        state.currentChallengeIndex = -1;
    }

    EventHandlers.init();
    UIManager.showScreen('accountSelectScreen');
}


document.addEventListener('DOMContentLoaded', initApp);
