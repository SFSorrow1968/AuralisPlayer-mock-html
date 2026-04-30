/*
 * Auralis JS shard: 10aa-zenith-library-appearance-slider.js
 * Purpose: compact slider controls for library appearance settings.
 */

    function appendSettingsSlider(container, { label = '', title = '', min = 1, max = 3, value = 2, onInput }) {
        if (!container) return null;
        const wrapper = document.createElement('label');
        wrapper.className = 'settings-choice-slider library-appearance-slider';
        wrapper.title = title;
        const valueText = document.createElement('span');
        valueText.className = 'settings-choice-slider-value';
        valueText.textContent = `${label} ${value}`;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        input.value = String(value);
        input.setAttribute('aria-label', title || label);
        input.addEventListener('input', () => {
            const nextValue = normalizeLibraryGridColumns(input.value, value);
            valueText.textContent = `${label} ${nextValue}`;
            if (typeof onInput === 'function') onInput(nextValue);
        });
        wrapper.append(valueText, input);
        container.appendChild(wrapper);
        return wrapper;
    }
