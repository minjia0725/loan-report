import { computed } from 'vue';

export function useLoanCalculator(params) {
    
    // 輔助格式化函數
    const formatMoney = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0.0';
        return val.toFixed(1);
    };

    // 房貸計算基礎函數
    const calculateMonthlyPayment = (principal, rate, years) => {
        if(!principal || principal <= 0) return 0;
        const r = rate / 100 / 12;
        const n = years * 12;
        if (!r || !n) return 0;
        return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    };

    // 計算屬性：購屋貸款額度
    const purchaseLoanAmount = computed(() => 
        params.value.housePrice + params.value.decoration - params.value.mortgageLoan
    );

    // 計算屬性：月付金
    const mortgagePayment1 = computed(() => 
        calculateMonthlyPayment(params.value.mortgageLoan, params.value.interestRate1, params.value.years1)
    );
    
    const mortgagePayment2 = computed(() => 
        calculateMonthlyPayment(purchaseLoanAmount.value, params.value.interestRate2, params.value.years2)
    );
    
    const monthlyPaymentTotal = computed(() => 
        mortgagePayment1.value + mortgagePayment2.value
    );

    // 計算屬性：負擔比
    const monthlySalary = computed(() => params.value.annualSalary / 12);
    
    const burdenRatio = computed(() => {
        if (!monthlySalary.value || monthlySalary.value <= 0) return 0;
        return ((monthlyPaymentTotal.value / monthlySalary.value) * 100).toFixed(1);
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
            if(year === 3) {
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

            const totalIncome = actualSalary + params.value.rentIncome;
            const annualMortgage = monthlyPaymentTotal.value * 12;
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
                assets: accumulated
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
        mortgagePayment1,
        mortgagePayment2,
        monthlyPaymentTotal,
        burdenRatio,
        burdenRatioClass,
        burdenRatioColor,
        burdenRatioText,
        burdenRatioStatusClass,
        simulationData,
        totalAssets10Year
    };
}

