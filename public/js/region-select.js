(function () {
  function getJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error('Gagal memuat data wilayah.');
      }
      return response.json();
    });
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function namesMatch(optionName, selectedName) {
    const option = normalizeName(optionName);
    const selected = normalizeName(selectedName);
    if (!option || !selected) return false;
    return option === selected || option.replace(/^(kota|kabupaten)\s+/i, '') === selected.replace(/^(kota|kabupaten)\s+/i, '');
  }

  function setOptions(select, items, placeholder, selectedCode, selectedName) {
    select.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    items.forEach(function (item) {
      const option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.name;
      option.dataset.name = item.name;
      if ((selectedCode && selectedCode === item.code) || (!selectedCode && selectedName && namesMatch(item.name, selectedName))) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  function setHiddenText(select, hiddenInput) {
    if (!hiddenInput) return;
    const selected = select.options[select.selectedIndex];
    hiddenInput.value = selected && selected.value ? selected.dataset.name || selected.textContent : '';
  }

  function syncDisabledState(provinceSelect, citySelect, districtSelect) {
    citySelect.disabled = !provinceSelect.value;
    districtSelect.disabled = !citySelect.value;
  }

  async function initRegionSelect(root) {
    const provinceSelect = root.querySelector('[data-region-select="province"]');
    const citySelect = root.querySelector('[data-region-select="city"]');
    const districtSelect = root.querySelector('[data-region-select="district"]');

    if (!provinceSelect || !citySelect || !districtSelect) return;

    const provinceName = root.querySelector('[data-region-name="province"]');
    const cityName = root.querySelector('[data-region-name="city"]');
    const districtName = root.querySelector('[data-region-name="district"]');
    const initialProvinceCode = root.dataset.initialProvinceCode || '';
    const initialCityCode = root.dataset.initialCityCode || '';
    const initialDistrictCode = root.dataset.initialDistrictCode || '';
    const initialProvinceName = root.dataset.initialProvinceName || '';
    const initialCityName = root.dataset.initialCityName || '';
    const initialDistrictName = root.dataset.initialDistrictName || '';

    async function loadCities(selectedCode, selectedName) {
      setOptions(citySelect, [], 'Pilih kota/kabupaten', '', '');
      setOptions(districtSelect, [], 'Pilih kecamatan', '', '');
      setHiddenText(citySelect, cityName);
      setHiddenText(districtSelect, districtName);
      syncDisabledState(provinceSelect, citySelect, districtSelect);

      if (!provinceSelect.value) return;

      const result = await getJson('/api/regions/cities?provinceCode=' + encodeURIComponent(provinceSelect.value));
      setOptions(citySelect, result.data || [], 'Pilih kota/kabupaten', selectedCode, selectedName);
      setHiddenText(citySelect, cityName);
      syncDisabledState(provinceSelect, citySelect, districtSelect);
    }

    async function loadDistricts(selectedCode, selectedName) {
      setOptions(districtSelect, [], 'Pilih kecamatan', '', '');
      setHiddenText(districtSelect, districtName);
      syncDisabledState(provinceSelect, citySelect, districtSelect);

      if (!citySelect.value) return;

      const result = await getJson('/api/regions/districts?cityCode=' + encodeURIComponent(citySelect.value));
      setOptions(districtSelect, result.data || [], 'Pilih kecamatan', selectedCode, selectedName);
      setHiddenText(districtSelect, districtName);
      syncDisabledState(provinceSelect, citySelect, districtSelect);
    }

    provinceSelect.addEventListener('change', async function () {
      setHiddenText(provinceSelect, provinceName);
      await loadCities('', '');
    });

    citySelect.addEventListener('change', async function () {
      setHiddenText(citySelect, cityName);
      await loadDistricts('', '');
    });

    districtSelect.addEventListener('change', function () {
      setHiddenText(districtSelect, districtName);
    });

    try {
      const result = await getJson('/api/regions/provinces');
      setOptions(provinceSelect, result.data || [], 'Pilih provinsi', initialProvinceCode, initialProvinceName);
      setHiddenText(provinceSelect, provinceName);

      if (provinceSelect.value) {
        await loadCities(initialCityCode, initialCityName);
      }

      if (citySelect.value) {
        await loadDistricts(initialDistrictCode, initialDistrictName);
      }
    } catch (error) {
      console.error(error);
      setOptions(provinceSelect, [], 'Data wilayah belum tersedia', '');
      setOptions(citySelect, [], 'Data wilayah belum tersedia', '');
      setOptions(districtSelect, [], 'Data wilayah belum tersedia', '');
    }

    syncDisabledState(provinceSelect, citySelect, districtSelect);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-region-root]').forEach(initRegionSelect);
  });
})();
