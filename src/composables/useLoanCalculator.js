import { computed } from 'vue';

export function useLoanCalculator(params) {
    
    // 輔助格式化函數
    const formatMoney = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0.0';
        return val.toFixed(1);
    };

    // 本息平均攤還法 - 計算月付金 (給定本金、年利率、總期數)
    // PMT = P * (r(1+r)^n) / ((1+r)^n - 1)
    const calculateAmortizedPayment = (principal, rate, months) => {
        if (!principal || principal <= 0) return 0;
        if (rate <= 0) return principal / months; // 零利率
        const r = rate / 100 / 12;
        return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    };

    // 進階貸款計算：支援多段利率 + 寬限期
    // 回傳: { interestOnly: 0, amortized: 0, stages: [] }
    // stages 格式: [{ year: 1, rate: 2.5, payment: 12000, type: 'grace'|'amortized' }]
    const getLoanSchedule = (principal, rateConfig, totalYears, graceYears = 0) => {
        if (!principal || principal <= 0) {
            return { currentPayment: 0, schedule: [] };
        }

        // 將 rateConfig 標準化為陣列
        let rates = [];
        if (Array.isArray(rateConfig)) {
            rates = rateConfig;
        } else {
            // 單一利率視為 1~總年限 都是該利率
            rates = [{ yearStart: 1, yearEnd: totalYears, rate: rateConfig }];
        }

        const schedule = [];
        let remainingPrincipal = principal;
        let currentPayment = 0; // 第一年的月付金 (用於顯示 Summary)

        // 模擬每個月的還款 (為了精確，雖然效能稍差但對幾十年還好)
        // 為了簡化顯示邏輯，我們以「年」為單位進行利率切換模擬
        
        // 總期數 (月)
        const totalMonths = totalYears * 12;
        const graceMonths = graceYears * 12;

        // 預先建立每年的利率對照表
        const yearlyRates = {};
        rates.forEach(r => {
            for(let y = r.yearStart; y <= r.yearEnd; y++) {
                yearlyRates[y] = r.rate;
            }
        });

        // 填補未定義年份的利率 (沿用最後一段設定)
        let lastDefinedRate = rates.length > 0 ? rates[rates.length - 1].rate : 2.0;
        for(let y = 1; y <= totalYears; y++) {
            if (yearlyRates[y] === undefined) {
                yearlyRates[y] = lastDefinedRate;
            } else {
                lastDefinedRate = yearlyRates[y];
            }
        }

        // 逐年計算
        // 雖然實際銀行是按月變動，但這裡為了模擬簡化，假設同一年度內利率不變
        // 並且在寬限期後，重新計算剩餘期間的攤還金額
        
        for (let year = 1; year <= totalYears; year++) {
            const currentRate = yearlyRates[year];
            const isGracePeriod = year <= graceYears;
            
            let monthlyPayment = 0;
            
            if (isGracePeriod) {
                // 寬限期：只繳息
                monthlyPayment = remainingPrincipal * (currentRate / 100 / 12);
            } else {
                // 本息攤還期：根據剩餘本金、剩餘期數、當前利率重新計算 PMT
                const remainingMonths = (totalYears - year + 1) * 12;
                monthlyPayment = calculateAmortizedPayment(remainingPrincipal, currentRate, remainingMonths);
                
                // 計算這一年還掉多少本金 (概算)
                // 利息占比 = 本金 * 月利率
                // 本金占比 = 月付金 - 利息
                // 這裡做一個簡化：假設這一年每月本金下降導致利息微幅下降，但月付金固定
                // 為求精確，我們應該跑 12 個月的迴圈
                let yearPrincipalPaid = 0;
                for(let m=1; m<=12; m++) {
                    const interest = remainingPrincipal * (currentRate / 100 / 12);
                    const principalPaid = monthlyPayment - interest;
                    remainingPrincipal -= principalPaid;
                    yearPrincipalPaid += principalPaid;
                }
                // 修正迴圈後 remainingPrincipal 已經扣除
            }

            // 第一年的月付金作為代表
            if (year === 1) currentPayment = monthlyPayment;

            schedule.push({
                year,
                rate: currentRate,
                monthlyPayment,
                isGracePeriod
            });
        }

        return {
            currentPayment, // 第一年
            schedule        // 完整年表
        };
    };

    // 計算屬性：購屋貸款額度
    const purchaseLoanAmount = computed(() => 
        params.value.housePrice + params.value.decoration - params.value.mortgageLoan
    );

    // 計算屬性：貸款 1 排程
    const loan1Schedule = computed(() => 
        getLoanSchedule(params.value.mortgageLoan, params.value.rates1 || params.value.interestRate1, params.value.years1, params.value.gracePeriod1)
    );
    
    // 計算屬性：貸款 2 排程
    const loan2Schedule = computed(() => 
        getLoanSchedule(purchaseLoanAmount.value, params.value.rates2 || params.value.interestRate2, params.value.years2, params.value.gracePeriod2)
    );
    
    // 顯示用：總月付金 (顯示第一年，或本息攤還的第一年，視需求而定)
    // 為了保留原本邏輯「壓力測試」，我們這裡顯示「寬限期後的第一年」或是「最大月付金」比較好
    // 但為了簡單，先顯示「下個月需繳金額」(即第一年)
    const monthlyPaymentTotal = computed(() => 
        loan1Schedule.value.currentPayment + loan2Schedule.value.currentPayment
    );

    // 計算屬性：負擔比
    const monthlySalary = computed(() => params.value.annualSalary / 12);
    
    // 負擔比這裡改用「最高月付金」來計算壓力，避免只看寬限期覺得很輕鬆
    const maxMonthlyPayment = computed(() => {
        let max = 0;
        for(let i=0; i<10; i++) { // 只看前10年
            const p1 = loan1Schedule.value.schedule[i]?.monthlyPayment || 0;
            const p2 = loan2Schedule.value.schedule[i]?.monthlyPayment || 0;
            if (p1 + p2 > max) max = p1 + p2;
        }
        return max;
    });

    const burdenRatio = computed(() => {
        if (!monthlySalary.value || monthlySalary.value <= 0) return 0;
        return ((maxMonthlyPayment.value / monthlySalary.value) * 100).toFixed(1);
    });

    // 負擔比相關 UI 狀態
    const burdenRatioClass = computed(() => {
        if (burdenRatio.value < 30) return 'border-green-500';
        if (burdenRatio.value <= 33) return 'border-green-500';
        if (burdenRatio.value <= 40) return 'border-yellow-500';
        return 'border-red-500';
    });

    const burdenRatioColor = computed(() => {
        if (burdenRatio.value <= 33) return 'text-green-600';
        if (burdenRatio.value <= 40) return 'text-yellow-600';
        return 'text-red-600';
    });

    const burdenRatioText = computed(() => {
        if (burdenRatio.value < 30) return '非常輕鬆 (優)';
        if (burdenRatio.value <= 33) return '健康水位 (良)';
        if (burdenRatio.value <= 40) return '負擔適中 (可)';
        return '負擔沈重 (危)';
    });

    const burdenRatioStatusClass = computed(() => {
        if (burdenRatio.value <= 33) return 'status-safe';
        if (burdenRatio.value <= 40) return 'status-warn';
        return 'status-danger';
    });

    // 模擬未來 10 年現金流
    const simulationData = computed(() => {
        const data = [];
        let currentSalary = params.value.annualSalary;
        let accumulated = 0;
        
        const e = params.value.expense;
        let currentLiving = e.basic_food + e.basic_house + e.parents + e.shopping + e.travel + e.insurance + e.car; 
        
        for(let year = 1; year <= 10; year++) {
            // 薪資成長
            if(year > 1 && year <= 5) {
                currentSalary *= (1 + params.value.salaryGrowth / 100);
            }
            
            // 支出通膨
            if(year > 1) {
                currentLiving *= 1.03;
            }

            let actualSalary = currentSalary;
            let note = "";
            let noteClass = "";
            let extraExpense = 0;

            // 特殊事件模擬
            if(year === (params.value.babyYear || 3)) {
                note = "👼 懷孕育嬰";
                noteClass = "bg-pink-100 text-pink-800";
                const loss = currentSalary * 0.05; 
                actualSalary -= loss;
                extraExpense = e.baby;
            } else if (year <= 5) {
                note = "📈 薪資成長";
                noteClass = "bg-blue-100 text-blue-800";
            } else {
                note = "➖ 薪資持平";
                noteClass = "bg-gray-100 text-gray-600";
            }

            // 從排程表取出當年度房貸支出
            // 排程表索引從 0 開始 (year 1 -> index 0)
            const s1 = loan1Schedule.value.schedule[year-1];
            const s2 = loan2Schedule.value.schedule[year-1];
            
            const annualMortgage = ((s1?.monthlyPayment || 0) + (s2?.monthlyPayment || 0)) * 12;
            const isGracePeriod = (s1?.isGracePeriod || false) || (s2?.isGracePeriod || false);

            const totalIncome = actualSalary + params.value.rentIncome;
            const totalExpense = annualMortgage + currentLiving + extraExpense;
            const balance = totalIncome - totalExpense;
            accumulated += balance;

            data.push({
                year,
                note,
                noteClass,
                income: totalIncome,
                mortgage: annualMortgage,
                living: currentLiving + extraExpense,
                balance,
                assets: accumulated,
                isGracePeriod
            });
        }
        return data;
    });

    const totalAssets10Year = computed(() => {
        if (!simulationData.value || simulationData.value.length === 0) return 0;
        return simulationData.value[9].assets;
    });

    return {
        formatMoney,
        purchaseLoanAmount,
        monthlyPaymentTotal, // 這裡現在代表「第一年」或「當前」的月付金
        maxMonthlyPayment,   // 用於顯示最高壓力
        burdenRatio,
        burdenRatioClass,
        burdenRatioColor,
        burdenRatioText,
        burdenRatioStatusClass,
        simulationData,
        totalAssets10Year,
        loan1Schedule,
        loan2Schedule
    };
}
