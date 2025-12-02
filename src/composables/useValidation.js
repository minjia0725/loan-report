import { ref, watch } from 'vue';

export function useValidation(params) {
    const errors = ref({});

    const validate = () => {
        const newErrors = {};
        const p = params.value;

        // 房產資金驗證
        if (!p.housePrice || p.housePrice <= 0) newErrors.housePrice = "請輸入有效的房屋總價";
        if (p.decoration < 0) newErrors.decoration = "金額不能為負數";
        if (p.mortgageLoan < 0) newErrors.mortgageLoan = "金額不能為負數";
        if (p.mortgageLoan > (p.housePrice + p.decoration)) newErrors.mortgageLoan = "抵押貸款不能超過房價加裝潢總額";

        // 貸款條件驗證
        if (p.interestRate1 < 0) newErrors.interestRate1 = "利率不能為負";
        if (!p.years1 || p.years1 <= 0) newErrors.years1 = "請輸入有效年限";
        if (p.interestRate2 < 0) newErrors.interestRate2 = "利率不能為負";
        if (!p.years2 || p.years2 <= 0) newErrors.years2 = "請輸入有效年限";

        // 收入驗證
        if (!p.annualSalary || p.annualSalary <= 0) newErrors.annualSalary = "請輸入有效的家庭年薪";
        if (p.salaryGrowth < 0) newErrors.salaryGrowth = "成長率不能為負";
        if (p.rentIncome < 0) newErrors.rentIncome = "租金不能為負";

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

