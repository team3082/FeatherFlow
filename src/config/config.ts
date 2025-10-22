export interface Field {
    imagePath: string;
    width: number;
    height: number;
}

export const REEFSCAPE_FIELD: Field = {
    imagePath: '/reefscape_field.png',
    width: 1314,
    height: 732,
};

export const colorMap: Record<string, { bg: string; border: string; dot: string; color: string }> = {
    purple: { bg: 'bg-purple-900', border: 'border-purple-400', dot: 'bg-purple-500', color: 'text-purple-400 hover:text-purple-300' },
    red: { bg: 'bg-red-900', border: 'border-red-400', dot: 'bg-red-500', color: 'text-red-400 hover:text-red-300' },
    green: { bg: 'bg-green-800', border: 'border-green-600', dot: 'bg-green-600', color: 'text-green-400 hover:text-green-300' },
    blue: { bg: 'bg-blue-900', border: 'border-blue-600', dot: 'bg-blue-600', color: 'text-blue-600 hover:text-blue-500' }
};

export const FIELD_CONFIG: Field = REEFSCAPE_FIELD;
