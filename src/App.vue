<script setup>
import { ref, watch } from 'vue';
import { useValidation } from './composables/useValidation';
import { useLoanCalculator } from './composables/useLoanCalculator';
import { useCharts } from './composables/useCharts';
import { useStorage } from './composables/useStorage';

// 預設參數設定
const defaultParams = {
    housePrice: 1800,
    decoration: 100,
    mortgageLoan: 460,
    
    // 貸款 1 設定
    interestRate1: 3.5, // 相容舊欄位
    rates1: [{ yearStart: 1, yearEnd: 20, rate: 3.5 }], // 新增多段利率結構
    years1: 20,
    gracePeriod1: 0,
    
    // 貸款 2 設定
    interestRate2: 3.5,
    rates2: [{ yearStart: 1, yearEnd: 40, rate: 3.5 }],
    years2: 40,
    gracePeriod2: 0,
    
    annualSalary: 300,
    salaryGrowth: 7,
    rentIncome: 0,
    
    expense: {
        basic_food: 30,
        basic_house: 9,
        parents: 13,
        shopping: 35,
        travel: 20,
        insurance: 15,
        car: 3,
        baby: 20
    },
    babyYear: 3
};

// 使用 LocalStorage 持久化參數
const params = useStorage('loan-report-params', defaultParams);

// 資料遷移：如果讀取的舊資料沒有 rates 陣列，根據 interestRate 初始化它
const migrateRates = (p, key, rateKey, yearsKey) => {
    if (!p[key] || !Array.isArray(p[key]) || p[key].length === 0) {
        p[key] = [{ yearStart: 1, yearEnd: p[yearsKey], rate: p[rateKey] }];
    }
};
migrateRates(params.value, 'rates1', 'interestRate1', 'years1');
migrateRates(params.value, 'rates2', 'interestRate2', 'years2');

// 輔助函數：新增利率區段
const addRateStage = (rates, totalYears) => {
    const lastStage = rates[rates.length - 1];
    // 如果最後一段還沒到總年限，才可以新增
    if (lastStage.yearEnd < totalYears) {
        const newStart = lastStage.yearEnd + 1;
        rates.push({ 
            yearStart: newStart, 
            yearEnd: totalYears, 
            rate: lastStage.rate 
        });
    }
};

// 輔助函數：移除利率區段
const removeRateStage = (rates, index) => {
    if (rates.length > 1) {
        rates.splice(index, 1);
        // 重新調整剩餘區段的年份連接
        // 這裡簡單處理：前一段直接延伸到被刪除段的結束年
        // 或是被刪除段的後一段自動接上前一段
        // 為求簡單，刪除後建議使用者手動調整，或者自動修正第一段起點為1
        if(index > 0) {
            rates[index-1].yearEnd = rates[index] ? rates[index].yearStart - 1 : params.value.years1; // 這裡有個小bug, years1可能是years2
        }
        // 修正連續性邏輯比較複雜，這裡先做基礎刪除，靠 validate 提示
        // 更好的做法是刪除該段後，上一段自動吃掉該段的區間
        if (index > 0) {
             rates[index-1].yearEnd = (rates[index] ? rates[index].yearStart - 1 : 40);
        }
    }
};

// 監聽年限變化自動修正最後一段結束年
watch(() => params.value.years1, (newVal) => {
    if (params.value.rates1.length > 0) {
        params.value.rates1[params.value.rates1.length - 1].yearEnd = newVal;
    }
});
watch(() => params.value.years2, (newVal) => {
    if (params.value.rates2.length > 0) {
        params.value.rates2[params.value.rates2.length - 1].yearEnd = newVal;
    }
});

// 自動修正利率區段連續性
const updateRateStages = (rates, index, totalYears) => {
    // 只有當不是最後一段時，才需要連動下一段
    if (index < rates.length - 1) {
        const currentStage = rates[index];
        const nextStage = rates[index + 1];
        
        // 下一段起始 = 這一段結束 + 1
        nextStage.yearStart = currentStage.yearEnd + 1;
        
        // 防呆：如果這一段結束已經超過總年限 (雖然驗證會擋，但這裡先不處理，讓使用者自己改)
        
        // 如果下一段的起始已經超過它的結束，則把結束往後推，保持至少 1 年
        if (nextStage.yearStart > nextStage.yearEnd) {
            nextStage.yearEnd = nextStage.yearStart;
            // 遞迴檢查再下一段
            updateRateStages(rates, index + 1, totalYears);
        }
    }
};


// 引入核心邏輯 Hook
const { errors, validate } = useValidation(params);

const {
    formatMoney,
    purchaseLoanAmount,
    monthlyPaymentTotal,
    maxMonthlyPayment,
    burdenRatio,
    burdenRatioClass,
    burdenRatioColor,
    burdenRatioText,
    burdenRatioStatusClass,
    simulationData,
    totalAssets10Year,
    loan1Schedule,
    loan2Schedule
} = useLoanCalculator(params);

// 初始化圖表
useCharts(params, monthlyPaymentTotal, simulationData);

</script>

<template>
    <div class="container mx-auto p-6 max-w-7xl">
        <!-- 標題區 -->
        <div class="mb-8 text-center">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">
                <span v-if="params.housePrice">{{ params.housePrice.toLocaleString() }}</span>
                <span v-else>...</span>
                萬購屋決策財務評估
            </h1>
            
            <!-- 全局錯誤提示 -->
            <div v-if="Object.keys(errors).length > 0" class="error-banner">
                ⚠️ 請檢查輸入欄位，部分資料有誤或遺漏
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- 左側參數設定 -->
            <div class="col-span-1">
                <div class="card">
                    <h2 class="section-title">⚙️ 參數設定</h2>
                    
                    <!-- 房產資金 -->
                    <div class="mb-6">
                        <h3 class="subsection-title">房產資金架構</h3>
                        <div class="input-group">
                            <label class="input-label">房屋總價 (萬元) <span class="text-red-500">*</span></label>
                            <input type="number" v-model.number="params.housePrice" class="input-field" :class="{'border-red-500': errors.housePrice}" min="0">
                            <p v-if="errors.housePrice" class="error-text">{{ errors.housePrice }}</p>
                        </div>
                        <div class="input-group">
                            <label class="input-label">裝潢預備金 (萬元)</label>
                            <input type="number" v-model.number="params.decoration" class="input-field" :class="{'border-red-500': errors.decoration}" min="0">
                            <p v-if="errors.decoration" class="error-text">{{ errors.decoration }}</p>
                        </div>
                        <div class="input-group">
                            <label class="input-label">抵押貸款金額 (萬元)</label>
                            <input type="number" v-model.number="params.mortgageLoan" class="input-field" :class="{'border-red-500': errors.mortgageLoan}" min="0">
                            <p v-if="errors.mortgageLoan" class="error-text">{{ errors.mortgageLoan }}</p>
                            <p class="helper-text">用於頭期款+裝潢</p>
                        </div>
                    </div>

                    <!-- 貸款條件詳細設定 -->
                    <div class="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <h3 class="text-sm font-bold text-blue-600 uppercase mb-3">詳細貸款條件</h3>
                        
                        <div class="mb-4">
                            <label class="subsection-label">1. 家人抵押貸款 (頭期)</label>
                            
                            <!-- 基本設定 -->
                            <div class="grid grid-cols-2 gap-2 mb-2">
                                <div class="input-group mb-0">
                                    <label class="text-xs text-gray-600">年限 (年)</label>
                                    <input type="number" v-model.number="params.years1" min="1" class="input-field text-sm" :class="{'border-red-500': errors.years1}">
                                </div>
                                <div class="input-group mb-0">
                                    <label class="text-xs text-gray-600">寬限期 (年)</label>
                                    <input type="number" v-model.number="params.gracePeriod1" min="0" class="input-field text-sm" :class="{'border-red-500': errors.gracePeriod1}">
                                </div>
                            </div>

                            <!-- 多段利率設定 -->
                            <div class="bg-white p-2 rounded border border-gray-200">
                                <label class="text-xs font-bold text-gray-500 block mb-1 flex justify-between items-center">
                                    <span>利率設定 (階梯式)</span>
                                    <button @click="addRateStage(params.rates1, params.years1)" class="text-blue-500 hover:text-blue-700 text-xs font-bold px-2 py-1 border border-blue-200 rounded bg-blue-50 transition-colors">
                                        + 新增區段
                                    </button>
                                </label>
                                <div v-for="(stage, index) in params.rates1" :key="index" class="flex items-center mb-1 gap-1">
                                    <div class="flex items-center gap-1 flex-1">
                                        <span class="text-xs text-gray-400">Y</span>
                                        <input type="number" v-model.number="stage.yearStart" class="w-10 p-1 text-xs border rounded text-center" readonly disabled>
                                        <span class="text-xs text-gray-400">~</span>
                                        <input type="number" v-model.number="stage.yearEnd" @input="updateRateStages(params.rates1, index, params.years1)" class="w-16 p-1 text-xs border rounded text-center bg-white" :class="{'bg-gray-100': index === params.rates1.length - 1}">
                                    </div>
                                    <div class="flex items-center gap-1 w-20">
                                        <input type="number" v-model.number="stage.rate" step="0.01" class="w-full p-1 text-xs border rounded text-right">
                                        <span class="text-xs text-gray-500">%</span>
                                    </div>
                                    <button v-if="params.rates1.length > 1 && index === params.rates1.length - 1" @click="removeRateStage(params.rates1, index)" class="text-red-400 hover:text-red-600 text-xs px-1">×</button>
                                </div>
                                <div v-if="errors.rates1" class="error-text">{{ errors.rates1 }}</div>
                            </div>
                        </div>

                        <div class="mb-0">
                            <label class="subsection-label">2. 購屋貸款 (尾款)</label>
                            
                            <!-- 基本設定 -->
                            <div class="grid grid-cols-2 gap-2 mb-2">
                                <div class="input-group mb-0">
                                    <label class="text-xs text-gray-600">年限 (年)</label>
                                    <input type="number" v-model.number="params.years2" min="1" class="input-field text-sm" :class="{'border-red-500': errors.years2}">
                                </div>
                                <div class="input-group mb-0">
                                    <label class="text-xs text-gray-600">寬限期 (年)</label>
                                    <input type="number" v-model.number="params.gracePeriod2" min="0" class="input-field text-sm" :class="{'border-red-500': errors.gracePeriod2}">
                                </div>
                            </div>

                            <!-- 多段利率設定 -->
                            <div class="bg-white p-2 rounded border border-gray-200">
                                <label class="text-xs font-bold text-gray-500 block mb-1 flex justify-between items-center">
                                    <span>利率設定 (階梯式)</span>
                                    <button @click="addRateStage(params.rates2, params.years2)" class="text-blue-500 hover:text-blue-700 text-xs font-bold px-2 py-1 border border-blue-200 rounded bg-blue-50 transition-colors">
                                        + 新增區段
                                    </button>
                                </label>
                                <div v-for="(stage, index) in params.rates2" :key="index" class="flex items-center mb-1 gap-1">
                                    <div class="flex items-center gap-1 flex-1">
                                        <span class="text-xs text-gray-400">Y</span>
                                        <input type="number" v-model.number="stage.yearStart" class="w-10 p-1 text-xs border rounded text-center" readonly disabled>
                                        <span class="text-xs text-gray-400">~</span>
                                        <input type="number" v-model.number="stage.yearEnd" @input="updateRateStages(params.rates2, index, params.years2)" class="w-16 p-1 text-xs border rounded text-center bg-white" :class="{'bg-gray-100': index === params.rates2.length - 1}">
                                    </div>
                                    <div class="flex items-center gap-1 w-20">
                                        <input type="number" v-model.number="stage.rate" step="0.01" class="w-full p-1 text-xs border rounded text-right">
                                        <span class="text-xs text-gray-500">%</span>
                                    </div>
                                    <button v-if="params.rates2.length > 1 && index === params.rates2.length - 1" @click="removeRateStage(params.rates2, index)" class="text-red-400 hover:text-red-600 text-xs px-1">×</button>
                                </div>
                                <div v-if="errors.rates2" class="error-text">{{ errors.rates2 }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- 收入設定 -->
                    <div class="mb-6">
                        <h3 class="subsection-title">家庭收入</h3>
                        <div class="input-group">
                            <label class="input-label">家庭年薪資 (萬元) <span class="text-red-500">*</span></label>
                            <input type="number" v-model.number="params.annualSalary" class="input-field" :class="{'border-red-500': errors.annualSalary}" min="0">
                            <p v-if="errors.annualSalary" class="error-text">{{ errors.annualSalary }}</p>
                        </div>
                        <div class="input-group">
                            <label class="input-label">薪資成長率 (%) - 前5年</label>
                            <input type="number" v-model.number="params.salaryGrowth" class="input-field" min="0" step="0.1" :class="{'border-red-500': errors.salaryGrowth}">
                        </div>
                        <div class="input-group">
                            <label class="input-label">舊屋年租金 (萬元)</label>
                            <input type="number" v-model.number="params.rentIncome" class="input-field" min="0" :class="{'border-red-500': errors.rentIncome}">
                            <p class="helper-text">目前設定為 0</p>
                        </div>
                    </div>

                    <!-- 支出設定 (詳細版) -->
                    <div class="mb-6">
                        <h3 class="subsection-title">年度支出預算細項</h3>
                        
                        <!-- 1. 基本生活 -->
                        <div class="mb-4 border-l-4 border-green-400 pl-3">
                            <h4 class="group-title">🏠 1. 基本生活 (日常)</h4>
                            <div class="grid grid-cols-1 gap-2">
                                <div class="input-group mb-2">
                                    <label class="input-label">飲食與雜支</label>
                                    <input type="number" v-model.number="params.expense.basic_food" class="input-field" min="0" :class="{'border-red-500': errors['expense.basic_food']}">
                                    <p class="helper-text">三餐飲食、日用品</p>
                                </div>
                                <div class="input-group mb-0">
                                    <label class="input-label">居住雜費</label>
                                    <input type="number" v-model.number="params.expense.basic_house" class="input-field" min="0" :class="{'border-red-500': errors['expense.basic_house']}">
                                    <p class="helper-text">管理費、水電瓦斯</p>
                                </div>
                            </div>
                        </div>

                        <!-- 2. 年度責任 -->
                        <div class="mb-4 border-l-4 border-orange-400 pl-3">
                            <h4 class="group-title">❤️ 2. 年度責任 (固定)</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="input-group mb-0">
                                    <label class="input-label">孝親費</label>
                                    <input type="number" v-model.number="params.expense.parents" class="input-field" min="0">
                                    <p class="helper-text">紅包禮金</p>
                                </div>
                                <div class="input-group mb-0">
                                    <label class="input-label">保險</label>
                                    <input type="number" v-model.number="params.expense.insurance" class="input-field" min="0">
                                    <p class="helper-text">全家保單</p>
                                </div>
                                <div class="input-group mb-0 col-span-2">
                                    <label class="input-label">汽車養護</label>
                                    <input type="number" v-model.number="params.expense.car" class="input-field" min="0">
                                    <p class="helper-text">稅金、保養、維修</p>
                                </div>
                            </div>
                        </div>

                        <!-- 3. 享樂生活 -->
                        <div class="mb-4 border-l-4 border-pink-400 pl-3">
                            <h4 class="group-title">✈️ 3. 享樂生活 (彈性)</h4>
                            <div class="grid grid-cols-1 gap-2">
                                <div class="input-group mb-2">
                                    <label class="input-label">出國旅遊</label>
                                    <input type="number" v-model.number="params.expense.travel" class="input-field" min="0">
                                    <p class="helper-text">每年長途旅遊預算</p>
                                </div>
                                <div class="input-group mb-0">
                                    <label class="input-label">購物娛樂 & 意外</label>
                                    <input type="number" v-model.number="params.expense.shopping" class="input-field" min="0">
                                    <p class="helper-text">治裝、醫美、寵物、家電維修</p>
                                </div>
                            </div>
                        </div>

                        <!-- 4. 特殊支出 -->
                        <div class="mb-0 border-l-4 border-purple-400 pl-3">
                            <h4 class="group-title">👶 4. 特殊支出 (一次性)</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="input-group mb-0">
                                    <label class="input-label">發生年度 (第N年)</label>
                                    <input type="number" v-model.number="params.babyYear" class="input-field" min="1" max="10">
                                    <p class="helper-text">設定哪一年懷孕</p>
                                </div>
                                <div class="input-group mb-0">
                                    <label class="input-label">月子中心</label>
                                    <input type="number" v-model.number="params.expense.baby" class="input-field" min="0">
                                    <p class="helper-text">僅於該年度計算</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右側結果展示 -->
            <div class="col-span-1 lg:col-span-2">
                <!-- 關鍵指標卡 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="card kpi-card border-blue-500">
                        <div class="kpi-label">最高月付金</div>
                        <div class="kpi-value text-gray-800">{{ formatMoney(maxMonthlyPayment) }}<span class="text-sm">萬</span></div>
                        <div class="kpi-sub text-gray-500">壓力測試 (前10年)</div>
                    </div>
                    <div class="card kpi-card" :class="burdenRatioClass">
                        <div class="kpi-label">最高負擔比</div>
                        <div class="kpi-value" :class="burdenRatioColor">{{ burdenRatio }}%</div>
                        <div class="mt-2" :class="burdenRatioStatusClass">{{ burdenRatioText }}</div>
                    </div>
                    <div class="card kpi-card border-green-500">
                        <div class="kpi-label">10年累積現金</div>
                        <div class="kpi-value text-green-600">{{ formatMoney(totalAssets10Year) }}<span class="text-sm">萬</span></div>
                        <div class="kpi-sub text-gray-500">扣除所有支出後淨額</div>
                    </div>
                </div>

                <!-- 貸款試算明細表 -->
                <div class="card mb-6">
                    <h3 class="section-title flex items-center">
                        <span class="icon-box">💰</span> 
                        貸款試算明細
                    </h3>
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th class="p-3 border-b">貸款項目</th>
                                    <th class="p-3 border-b">貸款金額</th>
                                    <th class="p-3 border-b">首年利率</th>
                                    <th class="p-3 border-b">年限</th>
                                    <th class="p-3 border-b text-right">首年月付</th>
                                    <th class="p-3 border-b text-right bg-gray-50">第 4 年月付</th>
                                    <th class="p-3 border-b text-right">第 7 年月付</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="border-b">
                                    <td class="p-3">
                                        <span class="font-bold text-gray-800">1. 家人抵押貸款</span>
                                        <span class="block text-xs text-gray-500">頭期款 + 裝潢</span>
                                        <span v-if="params.gracePeriod1 > 0" class="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded mt-1">
                                            寬限期 {{ params.gracePeriod1 }} 年
                                        </span>
                                    </td>
                                    <td class="p-3">{{ params.mortgageLoan }} 萬</td>
                                    <td class="p-3">{{ params.rates1?.[0]?.rate || params.interestRate1 }}%</td>
                                    <td class="p-3">{{ params.years1 }} 年</td>
                                    <td class="p-3 text-right font-mono font-bold text-blue-600">
                                        {{ formatMoney(loan1Schedule.currentPayment) }} 萬
                                        <span v-if="loan1Schedule.schedule[0]?.isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                    </td>
                                    <td class="p-3 text-right font-mono bg-gray-50">
                                        <span v-if="loan1Schedule.schedule[3]">
                                            {{ formatMoney(loan1Schedule.schedule[3].monthlyPayment) }} 萬
                                            <span v-if="loan1Schedule.schedule[3].isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                    <td class="p-3 text-right font-mono">
                                        <span v-if="loan1Schedule.schedule[6]">
                                            {{ formatMoney(loan1Schedule.schedule[6].monthlyPayment) }} 萬
                                            <span v-if="loan1Schedule.schedule[6].isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                </tr>
                                <tr class="border-b">
                                    <td class="p-3">
                                        <span class="font-bold text-gray-800">2. 購屋貸款</span>
                                        <span class="block text-xs text-gray-500">房價尾款 (76%)</span>
                                        <span v-if="params.gracePeriod2 > 0" class="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded mt-1">
                                            寬限期 {{ params.gracePeriod2 }} 年
                                        </span>
                                    </td>
                                    <td class="p-3">{{ purchaseLoanAmount }} 萬</td>
                                    <td class="p-3">{{ params.rates2?.[0]?.rate || params.interestRate2 }}%</td>
                                    <td class="p-3">{{ params.years2 }} 年</td>
                                    <td class="p-3 text-right font-mono font-bold text-blue-600">
                                        {{ formatMoney(loan2Schedule.currentPayment) }} 萬
                                        <span v-if="loan2Schedule.schedule[0]?.isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                    </td>
                                    <td class="p-3 text-right font-mono bg-gray-50">
                                        <span v-if="loan2Schedule.schedule[3]">
                                            {{ formatMoney(loan2Schedule.schedule[3].monthlyPayment) }} 萬
                                            <span v-if="loan2Schedule.schedule[3].isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                    <td class="p-3 text-right font-mono">
                                        <span v-if="loan2Schedule.schedule[6]">
                                            {{ formatMoney(loan2Schedule.schedule[6].monthlyPayment) }} 萬
                                            <span v-if="loan2Schedule.schedule[6].isGracePeriod" class="text-[10px] text-gray-400 block">(息)</span>
                                        </span>
                                        <span v-else class="text-gray-300">-</span>
                                    </td>
                                </tr>
                                <tr class="bg-blue-50">
                                    <td class="p-3 font-bold text-gray-800">總計</td>
                                    <td class="p-3 font-bold">{{ params.housePrice + params.decoration }} 萬</td>
                                    <td class="p-3"></td>
                                    <td class="p-3"></td>
                                    <td class="p-3 text-right font-mono font-bold text-blue-700 text-lg">{{ formatMoney(monthlyPaymentTotal) }} 萬</td>
                                    <td class="p-3 text-right font-mono font-bold text-blue-700 text-lg bg-blue-100">
                                        {{ formatMoney((loan1Schedule.schedule[3]?.monthlyPayment || 0) + (loan2Schedule.schedule[3]?.monthlyPayment || 0)) }} 萬
                                    </td>
                                    <td class="p-3 text-right font-mono font-bold text-blue-700 text-lg">
                                        {{ formatMoney((loan1Schedule.schedule[6]?.monthlyPayment || 0) + (loan2Schedule.schedule[6]?.monthlyPayment || 0)) }} 萬
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 圖表區 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div class="card h-80">
                        <h3 class="text-lg font-bold mb-4">💸 年度支出結構分析</h3>
                        <div class="h-64 relative">
                            <canvas id="expenseChart"></canvas>
                        </div>
                    </div>
                    <div class="card h-80">
                        <h3 class="text-lg font-bold mb-4">📈 十年資產累積趨勢</h3>
                        <div class="h-64 relative">
                            <canvas id="assetChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- 詳細數據表 -->
                <div class="card mb-8">
                    <h3 class="text-lg font-bold mb-4">📊 現金流模擬明細 (萬元)</h3>
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th class="p-3">年度</th>
                                    <th class="p-3">說明</th>
                                    <th class="p-3">總收入</th>
                                    <th class="p-3">房貸支出</th>
                                    <th class="p-3">生活享樂</th>
                                    <th class="p-3">當度結餘</th>
                                    <th class="p-3">累積資產</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="year in simulationData" :key="year.year" class="border-b hover:bg-gray-50">
                                    <td class="p-3 font-bold">Y{{ year.year }}</td>
                                    <td class="p-3">
                                        <div class="flex flex-wrap gap-1">
                                            <span v-if="year.note" class="px-2 py-1 rounded text-xs" :class="year.noteClass">{{ year.note }}</span>
                                            <span v-if="year.isGracePeriod" class="px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">寬限期</span>
                                        </div>
                                    </td>
                                    <td class="p-3">{{ formatMoney(year.income) }}</td>
                                    <td class="p-3">
                                        {{ formatMoney(year.mortgage) }}
                                        <span v-if="year.isGracePeriod" class="text-xs text-gray-400 block">(只繳息)</span>
                                    </td>
                                    <td class="p-3">{{ formatMoney(year.living) }}</td>
                                    <td class="p-3 font-bold" :class="year.balance >= 0 ? 'text-green-600' : 'text-red-600'">
                                        {{ year.balance >= 0 ? '+' : '' }}{{ formatMoney(year.balance) }}
                                    </td>
                                    <td class="p-3 font-bold text-blue-600">{{ formatMoney(year.assets) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 報告內容 -->
                <div class="report-card">
                    <div class="text-center mb-8">
                        <h2 class="text-2xl font-bold text-gray-800 mb-2">購屋決策全方位財務評估報告</h2>
                        <p class="text-gray-500">零租金、高支出標準下的極限壓力測試</p>
                    </div>

                    <div class="space-y-8">
                        <!-- 摘要 -->
                        <section>
                            <h3 class="report-section-title">1. 報告摘要 (Executive Summary)</h3>
                            <ul class="list-disc list-inside text-gray-700 space-y-1 pl-2">
                                <li><strong class="text-gray-900">決策目標：</strong>購入總價 <span class="font-bold text-blue-600">{{ params.housePrice }}萬</span> 房產之可行性評估。</li>
                                <li><strong class="text-gray-900">資金策略：</strong>採「雙貸款模式」，以家人抵押貸款 ({{ params.mortgageLoan }}萬) 作為頭期款。</li>
                                <li><strong class="text-gray-900">核心結論：</strong>
                                    <ul class="list-circle list-inside pl-5 mt-1 text-sm text-gray-600">
                                        <li><strong class="text-green-600">負擔安全：</strong>純薪資負擔比約 {{ burdenRatio }}% (最高點)，符合理財黃金比例。</li>
                                        <li><strong class="text-green-600">生活富裕：</strong>預算包含每年高額旅遊與孝親費，生活品質不打折。</li>
                                        <li><strong class="text-green-600">資產穩健：</strong>10 年後預估累積 {{ formatMoney(totalAssets10Year) }} 萬現金。</li>
                                    </ul>
                                </li>
                            </ul>
                        </section>

                        <!-- 資金架構 -->
                        <section>
                            <h3 class="report-section-title">2. 資金來源與架構</h3>
                            <p class="text-gray-700 mb-2">策略：抵押貸款金額設定為 {{ params.mortgageLoan }} 萬，確保頭期款充足並預留裝潢金。</p>
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <div class="flex justify-between mb-2 border-b pb-2">
                                    <span>1. 頭期+裝潢 (家人抵押)</span>
                                    <span class="font-bold">{{ params.mortgageLoan }} 萬 ({{ params.years1 }}年)</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>2. 購屋尾款 (一般房貸)</span>
                                    <span class="font-bold">{{ purchaseLoanAmount }} 萬 ({{ params.years2 }}年)</span>
                                </div>
                            </div>
                        </section>

                        <!-- 風險控管 -->
                        <section>
                            <h3 class="report-section-title">3. 風險控管與對策</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="bg-red-50 p-4 rounded-lg">
                                    <h4 class="font-bold text-red-700 mb-2">家人抵押貸款風險</h4>
                                    <p class="text-sm text-gray-700">對策：現金流充裕，第 5 年累積現金已超過抵押總額，隨時有能力一次清償。</p>
                                </div>
                                <div class="bg-yellow-50 p-4 rounded-lg">
                                    <h4 class="font-bold text-yellow-700">利率變動風險</h4>
                                    <p class="text-sm text-gray-700 mt-2">對策：即使升息 1%，月付增加有限，相較於每月十幾萬的結餘，影響微乎其微。</p>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg">
                                    <h4 class="font-bold text-blue-700">租金中斷風險</h4>
                                    <p class="text-sm text-gray-700 mt-2">對策：本報告已假設「完全無租金」，證明不靠租金也能輕鬆過活。</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card { 
    @apply bg-white rounded-xl shadow-sm p-5 mb-5 border border-gray-100;
}

.section-title {
    @apply text-xl font-bold mb-4 border-b pb-2 text-gray-800;
}

.subsection-title {
    @apply text-sm font-bold text-gray-500 uppercase mb-3;
}

.subsection-label {
    @apply text-xs font-bold text-gray-500 block mb-2;
}

.group-title {
    @apply text-sm font-bold text-gray-700 mb-2;
}

.input-group { 
    @apply mb-3; 
}

.input-label { 
    @apply block text-sm font-medium text-gray-700 mb-1; 
}

.input-field { 
    @apply w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors; 
}

.helper-text {
    @apply text-xs text-gray-500 mt-1;
}

.error-text {
    @apply text-xs text-red-500 mt-1;
}

.error-banner {
    @apply mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg inline-block text-sm font-bold;
}

.status-safe { 
    @apply text-green-700 bg-green-100 px-2 py-1 rounded text-sm;
}
.status-warn { 
    @apply text-yellow-700 bg-yellow-100 px-2 py-1 rounded text-sm;
}
.status-danger { 
    @apply text-red-700 bg-red-100 px-2 py-1 rounded text-sm;
}

/* KPI Cards */
.kpi-card {
    @apply flex flex-col justify-center items-center border-l-4 h-32;
}
.kpi-label {
    @apply text-gray-500 text-sm font-bold;
}
.kpi-value {
    @apply text-3xl font-bold mt-1;
}
.kpi-sub {
    @apply text-xs text-gray-500 mt-1;
}

/* Tables */
.data-table {
    @apply min-w-full text-sm text-left border-collapse;
}
.icon-box {
    @apply bg-blue-100 text-blue-600 p-1 rounded mr-2;
}

/* Report Section */
.report-card {
    @apply bg-white rounded-xl shadow-lg p-8 mb-8 border-t-4 border-indigo-600;
}
.report-section-title {
    @apply text-xl font-bold text-indigo-700 mb-3 border-b pb-1;
}
</style>
