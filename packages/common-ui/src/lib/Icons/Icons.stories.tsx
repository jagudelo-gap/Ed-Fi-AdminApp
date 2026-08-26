import type { StoryFn } from '@storybook/react-vite';

import { allIcons } from './generated/stories.constants';

export default {
  title: 'Icons',
};

export const AllIcons: StoryFn = () => {
  return (
    <div>
      {allIcons.map(({ icons, name }, index) => (
        <>
          <div key={index} style={{ marginBottom: '20px' }}>
            <h2 style={{ textTransform: 'capitalize' }}>{name}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {icons.map((Icon, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'column',
                  border: '1px solid black',
                  marginBottom: '20px',
                  padding: '5px',
                  textAlign: 'center',
                }}
              >
                <Icon fontSize={30} />
                {(Icon as unknown as { displayName: string }).displayName} <br />
                {(Icon as unknown as { purpose: string }).purpose}
              </div>
            ))}
          </div>
        </>
      ))}
    </div>
  );
};
