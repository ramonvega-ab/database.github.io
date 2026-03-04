const text = 'ramon vegas';
const filter = 'ram';
const escapedFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp('(' + escapedFilter + ')', 'gi');
console.log(text.replace(regex, '<span class="highlight">$1</span>'));
