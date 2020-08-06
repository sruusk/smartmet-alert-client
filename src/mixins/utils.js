import {
  format, getDay, getDate, getMonth, getYear, addDays, startOfDay, endOfDay, isEqual, isBefore, isAfter, compareDesc,
} from 'date-fns';
import he from 'he';
import config from './config';

export default {
  mixins: [config],
  computed: {
    NUMBER_OF_DAYS: () => 5,
    WEEKDAY_NAMES: () => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    REGION_LAND: () => 'land',
    REGION_SEA: () => 'sea',
    WEATHER_UPDATE_TIME: () => 'weather_update_time',
    FLOOD_UPDATE_TIME: () => 'flood_update_time',
    UPDATE_TIME: () => 'update_time',
    WEATHER_WARNINGS: () => 'weather_finland_active_all',
    FLOOD_WARNINGS: () => 'flood_finland_active_all',
    INFO_FI: () => 'info_fi',
    INFO_SV: () => 'info_sv',
    INFO_EN: () => 'info_en',
    PHYSICAL_DIRECTION: () => 'physical_direction',
    PHYSICAL_VALUE: () => 'physical_value',
    EFFECTIVE_FROM: () => 'effective_from',
    EFFECTIVE_UNTIL: () => 'effective_until',
    WARNING_CONTEXT: () => 'warning_context',
    SEVERITY: () => 'severity',
    CONTEXT_EXTENSION: () => 'context_extension',
    DATE_TIME_FORMAT: () => 'd.M. H:mm',
    DATE_FORMAT: () => 'd.M.y',
    TIME_FORMAT: () => 'HH:mm',
    WIND: () => 'wind',
    SEA_WIND: () => 'sea-wind',
    WARNING_LEVELS: () => ['level-1', 'level-2', 'level-3', 'level-4'],
    typeClass() {
      return this.input.type.split(/(?=[A-Z])/).reduce((acc, part) => acc + (acc.length ? '-' : '') + part.toLowerCase(), '');
    },
    rotation() {
      return Number.isFinite(this.input.direction) ? Math.round((this.input.direction + 360) % 360) : 0;
    },
    severity() {
      if (this.input.severity < 2 || this.input.severity > 4) {
        return null;
      }
      return this.input.severity;
    },
  },
  methods: {
    uncapitalize(value) {
      if (!value) return '';
      const stringValue = value.toString();
      return stringValue.charAt(0).toLowerCase() + stringValue.slice(1);
    },
    warningType(properties) {
      return (
        this.uncapitalize((properties[this.WARNING_CONTEXT] + (properties[this.CONTEXT_EXTENSION] ? `-${properties[this.CONTEXT_EXTENSION]}` : ''))
          .split('-')
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1),
          )
          .join(''))
      );
    },
    regionFromReference(reference) {
      return reference.substring(reference.lastIndexOf('#') + 1);
    },
    validInterval(properties) {
      const effectiveFrom = new Date(properties[this.EFFECTIVE_FROM]);
      const effectiveUntil = new Date(properties[this.EFFECTIVE_UNTIL]);
      return `${format(effectiveFrom, this.DATE_TIME_FORMAT)} - ${format(effectiveUntil, this.DATE_TIME_FORMAT)}`;
    },
    effectiveDays(properties) {
      const effectiveFrom = new Date(properties[this.EFFECTIVE_FROM]);
      const effectiveUntil = new Date(properties[this.EFFECTIVE_UNTIL]);
      const currentDate = new Date(this.currentTime);
      return [...Array(this.NUMBER_OF_DAYS).keys()].map((index) => ((isBefore(effectiveFrom, startOfDay(addDays(currentDate, index + 1)))) &&
        (isAfter(effectiveUntil, endOfDay(addDays(currentDate, index - 1))))));
    },
    text(properties) {
      return properties[this.WARNING_CONTEXT] === this.SEA_WIND ? properties[this.PHYSICAL_VALUE] : '';
    },
    createWeatherWarning(warning) {
      let direction = 0;
      let severity = Number(warning.properties.severity.slice(-1));
      switch (warning.properties[this.WARNING_CONTEXT]) {
        case this.SEA_WIND:
          direction = warning.properties[this.PHYSICAL_DIRECTION] - 180;
          if (warning.properties[this.SEVERITY] === this.WARNING_LEVELS[0]) {
            severity += 1;
          }
          break;
        case this.WIND:
          direction = warning.properties[this.PHYSICAL_DIRECTION] - 90;
          break;
        default:
      }
      return {
        type: this.warningType(warning.properties),
        regions: {
          [this.regionFromReference(warning.properties.reference)]: true,
        },
        effectiveFrom: warning.properties[this.EFFECTIVE_FROM],
        effectiveUntil: warning.properties[this.EFFECTIVE_UNTIL],
        effectiveDays: this.effectiveDays(warning.properties),
        validInterval: this.validInterval(warning.properties),
        severity,
        direction,
        text: this.text(warning.properties),
        info: {
          fi: he.decode(warning.properties[this.INFO_FI]),
          sv: he.decode(warning.properties[this.INFO_SV]),
          en: he.decode(warning.properties[this.INFO_EN]),
        },
      };
    },
    createFloodWarning(warning) {
      console.log(warning);
      return {
        type: '',
        effectiveFrom: '',
        effectiveUntil: '',
        validInterval: '', // '8.7. 15:00 - 8.7. 24:00',
        severity: '',
        direction: null,
        text: '',
        info: {
          fi: '',
          sv: '',
          en: '',
        },
      };
    },
    createDays(warnings) {
      const currentDate = new Date(this.currentTime);
      return [...Array(this.NUMBER_OF_DAYS).keys()].map((index) => {
        const date = addDays(currentDate, index);
        return {
          weekdayName: this.WEEKDAY_NAMES[getDay(date)],
          day: getDate(date),
          month: getMonth(date) + 1,
          year: getYear(date),
          severity: Object.values(warnings).reduce((maxSeverity, warning) => (warning.effectiveDays[index] ? Math.max(warning.severity, maxSeverity) : maxSeverity), 0),
          updatedDate: format(this.updatedAt, this.DATE_FORMAT),
          updatedTime: format(this.updatedAt, this.TIME_FORMAT),
        };
      });
    },
    getMaxSeverities(warnings) {
      return Object.values(warnings).reduce((maxSeverities, warning) => {
        if ((maxSeverities[warning.type] == null) || (maxSeverities[warning.type] < warning.severity)) {
          // eslint-disable-next-line no-param-reassign
          maxSeverities[warning.type] = warning.severity;
        }
        return maxSeverities;
      }, {});
    },
    createLegend(severities) {
      return this.warningTypes.reduce((orderedSeverities, warningType) => {
        if (severities[warningType]) {
          orderedSeverities.push({
            type: warningType,
            severity: severities[warningType],
            visible: true,
          });
        }
        return orderedSeverities;
      }, []);
    },
    createRegions(warnings, legend) {
      const warningKeys = Object.keys(warnings);
      return [3, 2, 1].reduce((regionWarnings, severity) => {
        const warningsBySeverity = warningKeys.filter((key) => warnings[key].severity === severity);
        [...Array(this.NUMBER_OF_DAYS).keys()].forEach((day) => {
          const warningsByDay = warningsBySeverity.filter((key) => warnings[key].effectiveDays[day]);
          legend.map((legendItem) => legendItem.type).forEach((warningType) => {
            const warningsByType = warningsByDay.filter((key) => warnings[key].type === warningType);
            warningsByType.sort((key1, key2) => {
              const effectiveFrom1 = new Date(warnings[key1].effectiveFrom);
              const effectiveUntil1 = new Date(warnings[key1].effectiveUntil);
              const effectiveFrom2 = new Date(warnings[key2].effectiveFrom);
              const effectiveUntil2 = new Date(warnings[key2].effectiveUntil);
              return (isAfter(effectiveFrom1, effectiveFrom2) || (isEqual(effectiveFrom1, effectiveFrom2) && (isBefore(effectiveUntil1, effectiveUntil2))));
            });
            warningsByType.forEach((key) => {
              this.regionIds.forEach((regionId) => {
                if (warnings[key].regions[regionId]) {
                  const regionItems = regionWarnings[day][this.geometries[regionId].type];
                  let regionItem = regionItems.find((regionWarning) => regionWarning.key === regionId);
                  if (regionItem == null) {
                    regionItem = {
                      key: regionId,
                      name: this.geometries[regionId].name,
                      warnings: [],
                    };
                    regionItems.push(regionItem);
                  }
                  let warningItem = regionItem.warnings.find((warning) => warning.type === warningType);
                  if (warningItem == null) {
                    warningItem = {
                      type: warningType,
                      identifiers: [],
                    };
                    regionItem.warnings.push(warningItem);
                  }
                  if (!warningItem.identifiers.includes(key)) {
                    warningItem.identifiers.push(key);
                  }
                }
              });
            });
          });
        });
        return regionWarnings;
      }, [...Array(this.NUMBER_OF_DAYS).keys()].map(() => ({
        [this.REGION_LAND]: [],
        [this.REGION_SEA]: [],
      })));
    },

    isValid(warning) {
      return (((warning != null) && (warning.properties != null)) &&
      ((this.WARNING_LEVELS.slice(1).includes(warning.properties.severity)) ||
      ((warning.properties[this.WARNING_CONTEXT] === this.SEA_WIND) &&
        (this.WARNING_LEVELS.includes(warning.properties.severity)))));
    },

    handleMapWarnings(data) {
      const warnings = {};
      this.updatedAt = [this.WEATHER_UPDATE_TIME, this.FLOOD_UPDATE_TIME]
        .map((updateTime) => new Date(data[updateTime][0].properties[this.UPDATE_TIME]))
        .sort(compareDesc)[0];
      data[this.WEATHER_WARNINGS].forEach((warning) => {
        if (this.isValid(warning)) {
          if (warnings[warning.properties.identifier] == null) {
            warnings[warning.properties.identifier] = this.createWeatherWarning(warning);
          } else {
            warnings[warning.properties.identifier].regions[this.regionFromReference(warning.properties.reference)] = true;
          }
        }
      });
      data[this.FLOOD_WARNINGS].forEach((warning) => {
        if ((warnings != null) && (warnings.properties != null)) {
          warnings[warning.properties.identifier] = this.createFloodWarning(warning);
        }
      });
      const days = this.createDays(warnings);
      const maxSeverities = this.getMaxSeverities(warnings);
      const legend = this.createLegend(maxSeverities);
      const regions = this.createRegions(warnings, legend);
      return {
        warnings,
        days,
        regions,
        legend,
      };
    },
    isClientSide() {
      return ((typeof document !== 'undefined') && (document));
    },
  },
};