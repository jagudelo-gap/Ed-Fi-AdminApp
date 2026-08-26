export interface OdsStatusDisplay {
  label: string;
  colorScheme: string;
}

export const odsStatusDisplayMap: Record<string, OdsStatusDisplay> = {
  PendingCreate:    { label: 'Create: Pending',      colorScheme: 'yellow' },
  Created:          { label: 'Available',            colorScheme: 'green'  },
  CreateInProgress: { label: 'Create: In Progress',  colorScheme: 'yellow' },
  CreateFailed:     { label: 'Create: Failed',       colorScheme: 'red'    },
  CreateError:      { label: 'Create: Failed',       colorScheme: 'red'    },
  PendingDelete:    { label: 'Delete: Pending',      colorScheme: 'yellow' },
  DeleteInProgress: { label: 'Delete: In Progress',  colorScheme: 'yellow' },
  Deleted:          { label: 'Deleted',              colorScheme: 'green'  },
  DeleteFailed:     { label: 'Delete: Failed',       colorScheme: 'red'    },
  DeleteError:      { label: 'Delete: Failed',       colorScheme: 'red'    },
  null:             { label: '',                     colorScheme: ''       },
};