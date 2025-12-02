import { ref, watch } from 'vue';

export function useStorage(key, defaultValue) {
    // 嘗試從 LocalStorage 讀取資料
    const storedValue = localStorage.getItem(key);
    let initialValue = defaultValue;

    if (storedValue) {
        try {
            // 合併儲存的設定與預設值，確保新增加的欄位不會遺失
            const parsed = JSON.parse(storedValue);
            initialValue = { ...defaultValue, ...parsed, expense: { ...defaultValue.expense, ...parsed.expense } };
        } catch (e) {
            console.error('Failed to parse stored value', e);
        }
    }

    const data = ref(initialValue);

    // 監聽數據變化並寫入 LocalStorage
    watch(data, (newValue) => {
        try {
            localStorage.setItem(key, JSON.stringify(newValue));
        } catch (e) {
            console.error('Failed to save to localStorage', e);
        }
    }, { deep: true });

    return data;
}

