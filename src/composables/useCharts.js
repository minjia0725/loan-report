import { nextTick, onMounted, watch } from 'vue';
import Chart from 'chart.js/auto';

export function useCharts(params, monthlyPaymentTotal, simulationData) {
    let expenseChartInstance = null;
    let assetChartInstance = null;

    const updateCharts = () => {
        // 1. 支出圓餅圖
        const ctxExpense = document.getElementById('expenseChart');
        if(ctxExpense) {
            if(expenseChartInstance) expenseChartInstance.destroy();
            
            const e = params.value.expense;
            const annualMortgage = monthlyPaymentTotal.value * 12;
            const annualLiving = e.basic_food + e.basic_house + e.car;
            const annualEnjoy = e.shopping + e.travel;
            const annualDuty = e.parents + e.insurance;
            
            expenseChartInstance = new Chart(ctxExpense, {
                type: 'doughnut',
                data: {
                    labels: ['房貸支出', '高端享樂', '年度責任', '基本生活'],
                    datasets: [{
                        data: [annualMortgage, annualEnjoy, annualDuty, annualLiving],
                        backgroundColor: ['#3b82f6', '#ec4899', '#f59e0b', '#10b981']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // 2. 資產累積圖
        const ctxAsset = document.getElementById('assetChart');
        if(ctxAsset) {
            if(assetChartInstance) assetChartInstance.destroy();
            
            const labels = simulationData.value.map(d => `Y${d.year}`);
            const assets = simulationData.value.map(d => d.assets);
            const colors = assets.map(a => a < 0 ? '#ef4444' : '#10b981');
            
            assetChartInstance = new Chart(ctxAsset, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '累積現金資產 (萬元)',
                        data: assets,
                        backgroundColor: colors,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    };

    // 監聽資料變化更新圖表
    watch([simulationData, monthlyPaymentTotal], () => {
        nextTick(() => {
            updateCharts();
        });
    }, { deep: true });

    onMounted(() => {
        updateCharts();
    });

    return {
        updateCharts
    };
}

