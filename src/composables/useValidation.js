import { ref, watch } from 'vue';

export function useValidation(params) {
    const errors = ref({});

    const validateRateConfig = (rates, totalYears) => {
        if (!Array.isArray(rates)) return null; // 單一數值不檢查
        
        // 檢查是否覆蓋第一年
        if (rates.length === 0 || rates[0].yearStart !== 1) {
            return "必須從第 1 年開始設定";
        }

        // 檢查連續性
        for(let i = 0; i < rates.length; i++) {
            const r = rates[i];
            if (r.rate < 0) return "利率不能為負";
            if (r.yearStart > r.yearEnd) return "起始年必須小於結束年";
            
            if (i > 0) {
                const prev = rates[i-1];
                if (r.yearStart !== prev.yearEnd + 1) {
                    return "年份必須連續";
                }
            }
        }
        return null;
    };

    const validate = () => {
        const newErrors = {};
        const p = params.value;

        // 房產資金驗證
        if (!p.housePrice || p.housePrice <= 0) newErrors.housePrice = "請輸入有效的房屋總價";
        if (p.decoration < 0) newErrors.decoration = "金額不能為負數";
        if (p.mortgageLoan < 0) newErrors.mortgageLoan = "金額不能為負數";
        if (p.mortgageLoan > (p.housePrice + p.decoration)) newErrors.mortgageLoan = "抵押貸款不能超過房價加裝潢總額";

        // 貸款條件驗證
        // 支援單一利率或多段利率
        if (!Array.isArray(p.rates1) && p.interestRate1 < 0) newErrors.interestRate1 = "利率不能為負";
        if (Array.isArray(p.rates1)) {
            const err = validateRateConfig(p.rates1, p.years1);
            if (err) newErrors.rates1 = err;
        }

        if (!p.years1 || p.years1 <= 0) newErrors.years1 = "請輸入有效年限";
        if (p.gracePeriod1 < 0) newErrors.gracePeriod1 = "寬限期不能為負";
        if (p.gracePeriod1 >= p.years1) newErrors.gracePeriod1 = "寬限期必須小於貸款年限";

        if (!Array.isArray(p.rates2) && p.interestRate2 < 0) newErrors.interestRate2 = "利率不能為負";
        if (Array.isArray(p.rates2)) {
            const err = validateRateConfig(p.rates2, p.years2);
            if (err) newErrors.rates2 = err;
        }

        if (!p.years2 || p.years2 <= 0) newErrors.years2 = "請輸入有效年限";
        if (p.gracePeriod2 < 0) newErrors.gracePeriod2 = "寬限期不能為負";
        if (p.gracePeriod2 >= p.years2) newErrors.gracePeriod2 = "寬限期必須小於貸款年限";

        // 收入驗證
        if (!p.annualSalary || p.annualSalary <= 0) newErrors.annualSalary = "請輸入有效的家庭年薪";
        if (p.salaryGrowth < 0) newErrors.salaryGrowth = "成長率不能為負";
        if (p.rentIncome < 0) newErrors.rentIncome = "租金不能為負";
        
        if (!p.babyYear || p.babyYear < 1) newErrors.babyYear = "請輸入有效的年度";

        // 支出驗證
        const checkExpense = (key, label) => {
            if (p.expense && p.expense[key] < 0) newErrors[`expense.${key}`] = `${label}不能為負數`;
        };
        checkExpense('basic_food', '飲食雜支');
        checkExpense('basic_house', '居住雜費');
        
        errors.value = newErrors;
    };

    // 監聽參數變化自動驗證
    watch(params, () => {
        validate();
    }, { deep: true, immediate: true });

    return {
        errors,
        validate
    };
}
