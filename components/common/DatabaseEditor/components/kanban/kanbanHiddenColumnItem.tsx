/* eslint-disable max-lines */
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useDrop } from 'react-dnd';
import type { IntlShape } from 'react-intl';

import type { BoardGroup } from 'lib/databases/board';
import type { BoardView } from 'lib/databases/boardView';
import type { Card } from 'lib/databases/card';

import mutator from '../../mutator';
import Button from '../../widgets/buttons/button';
import Label from '../../widgets/label';
import Menu from '../../widgets/menu';
import MenuWrapper from '../../widgets/menuWrapper';

type Props = {
  activeView: BoardView;
  group: BoardGroup;
  intl: IntlShape;
  readOnly: boolean;
  onDrop: (card: Card) => void;
};

export default function KanbanHiddenColumnItem(props: Props): JSX.Element {
  const { activeView, intl, group } = props;
  const [{ isOver }, drop] = useDrop<Card, any, { isOver: boolean }>(
    () => ({
      accept: 'card',
      collect: (monitor) => ({
        isOver: monitor.isOver()
      }),
      drop: (item) => {
        props.onDrop(item);
      }
    }),
    [props.onDrop]
  );

  let className = 'octo-board-hidden-item';
  if (isOver) {
    className += ' dragover';
  }

  return (
    <div ref={drop} key={group.id || 'empty'} className={className}>
      <MenuWrapper disabled={props.readOnly}>
        <Label key={group.id || 'empty'} color={group.option?.color}>
          {group.option?.value || group.value}
        </Label>
        <Menu>
          <Menu.Text
            id='show'
            icon={<VisibilityOutlinedIcon fontSize='small' />}
            name={intl.formatMessage({ id: 'BoardComponent.show', defaultMessage: 'Show' })}
            onClick={() => mutator.unhideViewColumn(activeView, group.id)}
          />
        </Menu>
      </MenuWrapper>
      <Button>{`${group.cards.length}`}</Button>
    </div>
  );
}
